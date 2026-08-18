import {
    DescriptionRounded,
    DatasetRounded,
    CheckCircleRounded,
    DownloadRounded
} from "@mui/icons-material";

import { Button as MuiButton } from "@mui/material";

function BatchSummaryCard({
    filename,
    totalMessages,
    successfulAnalyses,
    onDownload
}) {

    return (
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card text-card-foreground">

            {/* ==========================================
                HEADER
            ========================================== */}

            <div className="px-6 pt-6">

                <h2 className="text-xl font-bold">
                    Batch Analysis Summary
                </h2>

            </div>

            {/* ==========================================
                SUMMARY ITEMS
            ========================================== */}

            <div className="grid gap-8 px-6 py-8 md:grid-cols-3">

                {/* File Name */}

                <div className="flex flex-col items-center text-center">

                    <DescriptionRounded
                        sx={{
                            fontSize: 48,
                            color: "var(--primary)",
                            marginBottom: "12px"
                        }}
                    />

                    <p className="text-sm text-muted-foreground">
                        File Name
                    </p>

                    <p className="mt-1 max-w-full break-words text-sm font-bold text-foreground">
                        {filename}
                    </p>

                </div>

                {/* Total Messages */}

                <div className="flex flex-col items-center text-center">

                    <DatasetRounded
                        sx={{
                            fontSize: 48,
                            color: "var(--primary)",
                            marginBottom: "12px"
                        }}
                    />

                    <p className="text-sm text-muted-foreground">
                        Total Messages
                    </p>

                    <p className="mt-1 text-3xl font-bold text-foreground">
                        {totalMessages}
                    </p>

                </div>

                {/* Successful Analyses */}

                <div className="flex flex-col items-center text-center">

                    <CheckCircleRounded
                        sx={{
                            fontSize: 48,
                            color: "#2E7D32",
                            marginBottom: "12px"
                        }}
                    />

                    <p className="text-sm text-muted-foreground">
                        Successfully Analysed
                    </p>

                    <p className="mt-1 text-3xl font-bold text-foreground">
                        {successfulAnalyses}
                    </p>

                </div>

            </div>

            {/* ==========================================
                DOWNLOAD
            ========================================== */}

            <div className="flex justify-center border-t border-border px-6 py-6">

                <MuiButton
                    variant="contained"
                    size="large"
                    startIcon={<DownloadRounded />}
                    onClick={onDownload}
                    sx={{
                        px: 5,
                        py: 1.5,
                        borderRadius: 3,
                        bgcolor: "#6C3BFF",
                        color: "#FFFFFF",
                        textTransform: "none",
                        fontWeight: 700,
                        boxShadow: "none",

                        "&:hover": {
                            bgcolor: "#5B2FE3",
                            boxShadow: "none"
                        }
                    }}
                >
                    Download Result File
                </MuiButton>

            </div>

        </div>
    );
}

export default BatchSummaryCard;