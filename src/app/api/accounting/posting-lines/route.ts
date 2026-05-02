import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const ledgerId = searchParams.get("ledgerId");
    const entryId = searchParams.get("entryId");

    if (!ledgerId || !entryId) {
      return NextResponse.json(
        { error: "Missing ledgerId or entryId" },
        { status: 400 },
      );
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing authorization header" },
        { status: 401 },
      );
    }

    const token = authHeader.substring(7);
    const supabase = getSupabaseClient(token);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: ledger } = await supabase
      .from("ledgers")
      .select("workspace_id")
      .eq("id", ledgerId)
      .single();

    if (!ledger) {
      return NextResponse.json({ error: "Ledger not found" }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", ledger.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "Not a member of this workspace" },
        { status: 403 },
      );
    }

    const { data: lines, error: queryError } = await supabase
      .from("journal_entry_posting_lines")
      .select("account_code,amount,is_debit")
      .eq("ledger_id", ledgerId)
      .eq("entry_id", entryId)
      .order("created_at", { ascending: true });

    if (queryError) {
      throw queryError;
    }

    return NextResponse.json({
      lines:
        lines?.map((line) => ({
          accountCode: line.account_code,
          amount: String(line.amount),
          isDebit: line.is_debit,
        })) ?? [],
    });
  } catch (err) {
    console.error("Error fetching posting lines:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing authorization header" },
        { status: 401 },
      );
    }

    const token = authHeader.substring(7);
    const {
      ledgerId,
      entryId,
      postingLines,
    } = (await request.json()) as {
      ledgerId?: string;
      entryId?: string;
      postingLines?: Array<{ accountCode: number; amount: string | number; isDebit: boolean }>;
    };

    if (!ledgerId || !entryId || !Array.isArray(postingLines)) {
      return NextResponse.json(
        { error: "Missing ledgerId, entryId, or postingLines" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseClient(token);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: ledger } = await supabase
      .from("ledgers")
      .select("workspace_id")
      .eq("id", ledgerId)
      .single();

    if (!ledger) {
      return NextResponse.json({ error: "Ledger not found" }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", ledger.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "Not a member of this workspace" },
        { status: 403 },
      );
    }

    await supabase
      .from("journal_entry_posting_lines")
      .delete()
      .eq("ledger_id", ledgerId)
      .eq("entry_id", entryId);

    const linesToInsert = postingLines.map((line) => ({
      ledger_id: ledgerId,
      entry_id: entryId,
      account_code: line.accountCode,
      amount: line.amount.toString(),
      is_debit: line.isDebit,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabase
      .from("journal_entry_posting_lines")
      .insert(linesToInsert);

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      message: `Saved ${postingLines.length} posting lines`,
    });
  } catch (err) {
    console.error("Error saving posting lines:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
