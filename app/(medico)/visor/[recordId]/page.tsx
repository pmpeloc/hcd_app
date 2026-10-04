export default async function ViewerPage({
  params,
}: {
  params: Promise<{ recordId: string }>;
}) {
  const { recordId } = await params;
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold text-salua-navy">Visor de estudio</h1>
      <p className="text-salua-blue">Record: {recordId}</p>
    </main>
  );
}
