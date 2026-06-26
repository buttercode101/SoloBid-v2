import { DueTodayActionsPanel } from '../components/duetoday/DueTodayActionsPanel';

export default function DueToday() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="text-2xl md:text-4xl font-semibold tracking-tight text-zinc-900">DueToday</h1>
        <p className="text-zinc-500 mt-1.5 text-base font-normal">Review the money actions that need attention without changing your source records.</p>
      </div>
      <DueTodayActionsPanel />
    </div>
  );
}
