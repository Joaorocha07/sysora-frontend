import AppShell from '@/components/AppShell';
import { UnsavedChangesProvider } from '@/components/UnsavedChanges';

export default function CompanyAreaLayout({ children }: { children: React.ReactNode }) {
  return (
    <UnsavedChangesProvider>
      <AppShell>{children}</AppShell>
    </UnsavedChangesProvider>
  );
}
