import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth";

export async function GET() {
  const auth = await requireUserApi();
  if ("error" in auth) return auth.error;

  return NextResponse.json({
    data: {
      email: auth.profile?.email ?? auth.user.email ?? "",
      full_name: [auth.profile?.first_name, auth.profile?.last_name].filter(Boolean).join(" "),
      phone: auth.profile?.phone ?? "",
    },
  });
}
