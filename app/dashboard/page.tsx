import { DashboardClient } from './client';

export const metadata = {
  title: 'Nexus Bot Dashboard',
  description: 'Manage your AI-powered Discord bots.',
};

export default function DashboardPage() {
  return (
    <div className="w-full min-h-screen">
      <DashboardClient />
    </div>
  );
}
