import { supabase } from "@/lib/supabase";
import DeclarationsTable from "./DeclarationsTable";

export default async function MaritimeDeclarationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    status?: string;
    port?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const params = await searchParams;
  const { search, status, port, from, to } = params;

  let query = supabase
    .from("maritime_health_declarations")
    .select(`
      id, reference_no, status, ship_name, registration_imo_no,
      submitted_at_port, submission_date, master_name,
      sanitary_officer_in_charge, created_at, created_by,
      maritime_users:created_by (name)
    `, { count: "exact" })
    .is("deleted_at", null);

  if (search) {
    query = query.or(`ship_name.ilike.%${search}%,reference_no.ilike.%${search}%,registration_imo_no.eq.${search},master_name.ilike.%${search}%`);
  }
  if (status) query = query.eq("status", status);
  if (port) query = query.eq("submitted_at_port", port);
  if (from) query = query.gte("submission_date", from);
  if (to) query = query.lte("submission_date", to);

  const { data: declarations, error, count } = await query.order("created_at", { ascending: false });
  const { data: ports } = await supabase.from("maritime_health_declarations").select("submitted_at_port").is("deleted_at", null).not("submitted_at_port", "is", null);
  
  const uniquePorts = [...new Set(ports?.map(p => p.submitted_at_port).filter(Boolean))].sort();

  if (error) return <div className="p-6 text-red-600 font-bold">حدث خطأ في جلب البيانات: {error.message}</div>;

  return (
    <DeclarationsTable
      declarations={(declarations || []) as any}
      count={count || 0}
      uniquePorts={uniquePorts}
      searchParams={params}
    />
  );
}