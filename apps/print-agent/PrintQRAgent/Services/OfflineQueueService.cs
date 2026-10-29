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
        private readonly ConcurrentDictionary<string, PrintJobPayload> _jobs = new();
        private readonly HashSet<string> _processedIdempotencyKeys = new();

        public OfflineQueueService()
        {
            var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var dir = Path.Combine(appData, "PrintQR", "Agent");
            Directory.CreateDirectory(dir);
            _queueFilePath = Path.Combine(dir, "local_queue.json");

            LoadQueue();
        }

        public bool EnqueueJob(PrintJobPayload job)
        {
            if (_processedIdempotencyKeys.Contains(job.IdempotencyKey))
            {
                return false; // Prevent duplicate printing
            }

            _jobs[job.Id] = job;
            SaveQueue();
            return true;
        }

        public void MarkJobComplete(string jobId, string idempotencyKey)
        {
            _jobs.TryRemove(jobId, out _);
            _processedIdempotencyKeys.Add(idempotencyKey);
            SaveQueue();
        }

        public IEnumerable<PrintJobPayload> GetPendingJobs() => _jobs.Values;

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
            }
            catch { }
        }

        private void SaveQueue()
        {
            try
            {
                var json = JsonSerializer.Serialize(new List<PrintJobPayload>(_jobs.Values), new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(_queueFilePath, json);
            }
            catch { }
        }
    }
}
