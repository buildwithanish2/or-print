using System;
using System.Threading;

namespace PrintQRAgent.Services
{
    public sealed class SingleInstanceCoordinator : IDisposable
    {
        private readonly EventWaitHandle _activationEvent;
        private readonly Mutex _mutex;
        private RegisteredWaitHandle? _activationRegistration;
        private bool _ownsMutex;

        public bool IsPrimaryInstance { get; }

        public SingleInstanceCoordinator(string name, Action onActivate)
        {
            _activationEvent = new EventWaitHandle(false, EventResetMode.AutoReset, $"Local\\{name}.Activate");
            _mutex = new Mutex(true, $"Local\\{name}", out _ownsMutex);
            IsPrimaryInstance = _ownsMutex;

            if (IsPrimaryInstance)
            {
                _activationRegistration = ThreadPool.RegisterWaitForSingleObject(
                    _activationEvent,
                    (_, timedOut) => { if (!timedOut) onActivate(); },
                    null,
                    Timeout.Infinite,
                    executeOnlyOnce: false);
            }
            else
            {
                try { _activationEvent.Set(); } catch (ObjectDisposedException) { }
            }
        }

        public void Dispose()
        {
            _activationRegistration?.Unregister(null);
            _activationEvent.Dispose();
            if (_ownsMutex)
            {
                try { _mutex.ReleaseMutex(); } catch (ApplicationException) { }
            }
            _mutex.Dispose();
        }
    }
}
