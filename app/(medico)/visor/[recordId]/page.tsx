import { RecordViewer } from '@/components/viewer/record-viewer';

export default async function ViewerPage({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  return <RecordViewer recordId={recordId} />;
}
