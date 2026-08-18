import { supabase } from "@/lib/supabase";

export async function saveMessageScan({
    userId,
    inputMessage,
    analysisResult,
}) {
    const { data, error } = await supabase
        .from("message_scan_history")
        .insert({
            user_id: userId,
            input_message: inputMessage,
            analysis_result: analysisResult,
        })
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
}

export async function getMessageScanHistory(
    userId,
    limit = 20
) {
    const { data, error } = await supabase
        .from("message_scan_history")
        .select(
            "id, input_message, analysis_result, created_at"
        )
        .eq("user_id", userId)
        .order("created_at", {
            ascending: false,
        })
        .limit(limit);

    if (error) {
        throw error;
    }

    return data ?? [];
}