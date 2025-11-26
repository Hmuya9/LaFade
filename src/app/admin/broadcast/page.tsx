import { requireAdmin } from "@/lib/admin";

export default async function BroadcastPage() {
  await requireAdmin();

  return (
    <div className="max-w-3xl mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Send Notification</h1>
      <form action="/api/admin/broadcast" method="post" className="space-y-4">
        <input 
          name="subject" 
          required 
          className="w-full rounded-md border px-3 py-2" 
          placeholder="Subject" 
        />
        <textarea 
          name="message" 
          required 
          className="w-full rounded-md border px-3 py-2 h-40" 
          placeholder="Message (plain text or simple HTML)"
        />
        <button className="rounded-md bg-black text-white px-4 py-2">
          Send to All Users
        </button>
      </form>
    </div>
  );
}






