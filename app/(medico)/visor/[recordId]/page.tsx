import { PageHeader } from '@/components/page-header';

export default async function ViewerPage({
  params,
}: {
  params: Promise<{ recordId: string }>;
}) {
  const { recordId } = await params;
  return <PageHeader title="Visor de estudio" description={`Estudio ${recordId}`} />;
}
