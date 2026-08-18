import { supabase } from "@/lib/supabase";

export async function saveMessageBatch({
    userId,
    filename,
    totalMessages,
    successfulAnalyses,
    analysisResults,
}) {
    const { data, error } = await supabase
        .from("message_batch_history")
        .insert({
            user_id: userId,
            filename,
            total_messages: totalMessages,
            successful_analyses: successfulAnalyses,
            analysis_results: analysisResults,
        })
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
}


export async function getMessageBatchHistory(
    userId,
    limit = 20
) {
    const { data, error } = await supabase
        .from("message_batch_history")
        .select(
            "id, filename, total_messages, successful_analyses, analysis_results, created_at"
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