import {
    CheckCircleRounded,
    WarningAmberRounded,
    InfoRounded
} from "@mui/icons-material";

function BatchVerificationSummary({ rows }) {

    if (!rows || rows.length === 0) {
        return null;
    }

    // ==========================================
    // Calculate verification statistics
    // ==========================================

    const verifiedRows = rows.filter((row) => {

        const value =
            row["Cross-Verification (Model Agreement)"];

        return (
            value &&
            value.startsWith("Yes")
        );

    });

    const notVerifiedRows = rows.filter((row) => {

        const value =
            row["Cross-Verification (Model Agreement)"];

        return (
            !value ||
            value.startsWith("No")
        );

    });

    const totalMessages = rows.length;

    const verifiedCount =
        verifiedRows.length;

    const notVerifiedCount =
        notVerifiedRows.length;

    return (
        <div className="mt-4 rounded-xl border border-border bg-card text-card-foreground">

            <div className="p-6">

                {/* ==========================================
                    TITLE
                ========================================== */}

                <div className="mb-4 flex items-center gap-2">

                    <InfoRounded
                        sx={{
                            color: "var(--primary)"
                        }}
                    />

                    <h2 className="text-lg font-bold">
                        ScamSense Batch Verification
                    </h2>

                </div>

                {/* ==========================================
                    SUMMARY CHIPS
                ========================================== */}

                <div className="mb-6 flex flex-wrap gap-2">

                    {/* Total */}

                    <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">

                        <InfoRounded
                            sx={{
                                fontSize: 18
                            }}
                        />

                        {totalMessages} messages analysed

                    </div>

                    {/* No verification required */}

                    <div className="inline-flex items-center gap-2 rounded-full bg-green-500/10 px-3 py-1.5 text-sm font-semibold text-green-700 dark:text-green-400">

                        <CheckCircleRounded
                            sx={{
                                fontSize: 18
                            }}
                        />

                        {notVerifiedCount} did not require verification

                    </div>

                    {/* Verification required */}

                    <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-3 py-1.5 text-sm font-semibold text-orange-700 dark:text-orange-400">

                        <WarningAmberRounded
                            sx={{
                                fontSize: 18
                            }}
                        />

                        {verifiedCount} required verification

                    </div>

                </div>

                {/* ==========================================
                    EXPLANATION
                ========================================== */}

                <div className="mb-5 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">

                    <div className="flex gap-3">

                        <InfoRounded
                            sx={{
                                color: "#1976D2",
                                marginTop: "2px",
                                flexShrink: 0
                            }}
                        />

                        <div>

                            <p className="mb-2 font-semibold text-foreground">
                                When does ScamSense perform
                                additional verification?
                            </p>

                            <p className="text-sm leading-6 text-muted-foreground">
                                Additional internal cross-validation
                                is performed when the machine learning
                                prediction is uncertain.
                            </p>

                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">

                                <li>
                                    ML confidence is below 60%.
                                </li>

                                <li>
                                    ML confidence is between 60%
                                    and 79.99%.
                                </li>

                                <li>
                                    The confidence gap between the
                                    top two predictions is below 15%.
                                </li>

                            </ul>

                        </div>

                    </div>

                </div>

                {/* ==========================================
                    DIVIDER
                ========================================== */}

                <div className="my-5 border-t border-border" />

                {/* ==========================================
                    DESCRIPTION
                ========================================== */}

                <p className="text-sm leading-6 text-muted-foreground">
                    Each message can be selected from the table
                    below to view its individual confidence,
                    confidence gap and cross-validation result.
                </p>

            </div>

        </div>
    );
}

export default BatchVerificationSummary;