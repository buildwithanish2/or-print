using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using PrintQRAgent.Models;

namespace PrintQRAgent.Services
{
    public class OfflineQueueService
    {
        private readonly string _queueFilePath;
        private readonly string _processedFilePath;
        private readonly ConcurrentDictionary<string, PrintJobPayload> _jobs = new();
        private readonly HashSet<string> _processedIdempotencyKeys = new();
        private readonly object _sync = new();

        public OfflineQueueService(string? dataDirectory = null)
        {
            var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var dir = string.IsNullOrWhiteSpace(dataDirectory)
                ? Path.Combine(appData, "PrintQR", "Agent")
                : dataDirectory;
            Directory.CreateDirectory(dir);
            _queueFilePath = Path.Combine(dir, "local_queue.json");
            _processedFilePath = Path.Combine(dir, "processed_jobs.json");

            LoadQueue();
        }

        public bool EnqueueJob(PrintJobPayload job)
        {
            lock (_sync)
            {
                if (_processedIdempotencyKeys.Contains(job.IdempotencyKey)) return false;
                if (_jobs.ContainsKey(job.Id)) return false;
                _jobs[job.Id] = job;
                SaveQueue();
                return true;
            }
        }

        public void MarkJobResolved(string jobId, string idempotencyKey)
        {
            lock (_sync)
            {
                _jobs.TryRemove(jobId, out _);
                _processedIdempotencyKeys.Add(idempotencyKey);
                SaveQueue();
                SaveProcessed();
            }
        }

        // Persist the at-most-once print decision before calling the physical spooler.
        // A crash can leave an order requiring manual inspection, but cannot silently trigger another copy.
        public bool TryBeginPrint(string jobId, string idempotencyKey)
        {
            lock (_sync)
            {
                if (_processedIdempotencyKeys.Contains(idempotencyKey) || !_jobs.ContainsKey(jobId)) return false;
                _processedIdempotencyKeys.Add(idempotencyKey);
                // Never invoke the physical printer unless the at-most-once decision is on disk.
                if (!SaveProcessed())
                {
                    _processedIdempotencyKeys.Remove(idempotencyKey);
                    return false;
                }
                _jobs.TryRemove(jobId, out _);
                SaveQueue();
                return true;
            }
        }

        public IEnumerable<PrintJobPayload> GetPendingJobs() => _jobs.Values.ToArray();

        private void LoadQueue()
        {
            try
            {
                if (File.Exists(_queueFilePath))
                {
                    var json = File.ReadAllText(_queueFilePath);
                    var list = JsonSerializer.Deserialize<List<PrintJobPayload>>(json);
                    if (list != null)
                    {
                        foreach (var j in list) _jobs[j.Id] = j;
                    }
                }
                if (File.Exists(_processedFilePath))
                {
                    var processed = JsonSerializer.Deserialize<List<string>>(File.ReadAllText(_processedFilePath));
                    if (processed != null) foreach (var key in processed) _processedIdempotencyKeys.Add(key);
                }
            }
            catch { }
        }

        private void SaveQueue()
        {
            try
            {
                var json = JsonSerializer.Serialize(new List<PrintJobPayload>(_jobs.Values), new JsonSerializerOptions { WriteIndented = true });
                WriteAtomically(_queueFilePath, json);
            }
            catch { }
        }

        private bool SaveProcessed()
        {
            try
            {
                WriteAtomically(_processedFilePath, JsonSerializer.Serialize(_processedIdempotencyKeys));
                return true;
            }
            catch (Exception ex)
            {
                LoggerService.LogError("Could not persist the print idempotency ledger; refusing to print to prevent duplicates.", ex);
                return false;
            }
        }

        private static void WriteAtomically(string path, string content)
        {
            var temporary = path + ".tmp";
            using (var stream = new FileStream(temporary, FileMode.Create, FileAccess.Write, FileShare.None))
            using (var writer = new StreamWriter(stream))
            {
                writer.Write(content);
                writer.Flush();
                stream.Flush(true);
            }
            File.Move(temporary, path, true);
        }
    }
}
