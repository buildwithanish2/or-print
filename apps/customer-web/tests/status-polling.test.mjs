import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startStatusPolling } from '../src/lib/status-polling.js';

function fakeTimers() {
  const tasks = [];
  return {
    tasks,
    schedule(callback, delay) {
      const task = { callback, delay, cancelled: false };
      tasks.push(task);
      return task;
    },
    cancel(task) { task.cancelled = true; },
    async runNext() {
      const task = tasks.find((candidate) => !candidate.cancelled && !candidate.ran);
      assert.ok(task, 'expected a scheduled status check');
      task.ran = true;
      await task.callback();
    },
  };
}

test('pending manual UPI status keeps polling and stops only after server verification', async () => {
  const timers = fakeTimers();
  const statuses = ['PAYMENT_SUBMITTED', 'PAID'];
  const verified = [];
  let stopped = false;
  const stop = startStatusPolling(async () => {
    const status = statuses.shift();
    verified.push(status);
    return status === 'PAID';
  }, [2000], { initialDelay: 0, schedule: timers.schedule, cancel: timers.cancel, onStop: () => { stopped = true; } });

  await timers.runNext();
  assert.deepEqual(verified, ['PAYMENT_SUBMITTED']);
  assert.equal(stopped, false);
  assert.equal(timers.tasks.filter((task) => !task.cancelled && !task.ran).length, 1);

  await timers.runNext();
  assert.deepEqual(verified, ['PAYMENT_SUBMITTED', 'PAID']);
  assert.equal(stopped, true);
  stop();
});

test('temporary status network failure remains pending and continues bounded retries', async () => {
  const timers = fakeTimers();
  let checks = 0;
  startStatusPolling(async () => {
    checks += 1;
    throw new Error('temporary network error');
  }, [1000], { initialDelay: 0, schedule: timers.schedule, cancel: timers.cancel });

  await timers.runNext();
  assert.equal(checks, 1);
  assert.equal(timers.tasks.filter((task) => !task.cancelled && !task.ran).length, 1);
});
