import { useState } from "react";
import { DownloadRounded, Info } from "@mui/icons-material";

import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Button as MuiButton } from "@mui/material";

import MessageInputCard from "./components/message/MessageInputCard";
import PredictionCard from "./components/result/PredictionCard";
import VerificationCard from "./components/result/VerificationCard";
import InfoCard from "./components/result/InfoCard";
import BulletCard from "./components/result/BulletCard";

import ProcessingDialog from "./components/common/ProcessingDialog";
import BatchProcessingDialog from "./components/batch/BatchProcessingDialog";
import BatchSummaryCard from "./components/batch/BatchSummaryCard";
import BatchResultsTable from "./components/batch/BatchResultsTable";
import BatchVerificationSummary from "./components/batch/BatchVerificationSummary";

import {
    analyzeMessage,
    analyzeDataset,
    downloadDataset,
    downloadSingleMessageAnalysis
} from "./index";


function MessageScanPage() {

    // ==========================================
    // SINGLE MESSAGE STATE
    // ==========================================

    const [message, setMessage] = useState("");

    // ==========================================
    // BATCH DATASET STATE
    // ==========================================

    const [selectedFile, setSelectedFile] = useState(null);

    // ==========================================
    // ANALYSIS RESULT
    // ==========================================

    const [analysisResult, setAnalysisResult] = useState(null);

    // ==========================================
    // LOADING STATE
    // ==========================================

    const [loading, setLoading] = useState(false);
    const [batchLoading, setBatchLoading] = useState(false);

    const [batchResult, setBatchResult] = useState(null);

    // ==========================================
    // BATCH TABLE DIALOG
    // ==========================================

    const [selectedBatchRow, setSelectedBatchRow] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    // ==========================================
    // ANALYSIS MODES
    // ==========================================

    const isSingleMessageMode =
        message.trim().length > 0;

    const isBatchMode =
        selectedFile !== null;

    // ==========================================
    // ANALYZE SINGLE MESSAGE
    // ==========================================

    const handleAnalyze = async () => {

        if (!message.trim()) {
            return;
        }

        try {

            setLoading(true);

            setAnalysisResult(null);
            setBatchResult(null);

            const result =
                await analyzeMessage(message);

            setAnalysisResult(result);

        } catch (error) {

            console.error(error);

            alert(
                error.response?.data?.error ||
                "Unable to analyze message."
            );

        } finally {

            setLoading(false);

        }

    };

    // ==========================================
    // ANALYZE BATCH DATASET
    // ==========================================

    const handleAnalyzeDataset = async () => {

        if (!selectedFile) {
            return;
        }

        try {

            setAnalysisResult(null);
            setBatchResult(null);

            setBatchLoading(true);

            const result =
                await analyzeDataset(selectedFile);

            setBatchResult(result);

            console.log(
                "Batch Analysis Result",
                result
            );

        } catch (error) {

            console.error(error);

            alert(
                error.response?.data?.error ||
                "Unable to analyse dataset."
            );

        } finally {

            setBatchLoading(false);

        }

    };

    // ==========================================
    // DOWNLOAD BATCH RESULT
    // ==========================================

    const handleDownloadDataset = async (filename) => {

        try {

            const response =
                await downloadDataset(filename);

            const url =
                window.URL.createObjectURL(
                    response.data
                );

            const link =
                document.createElement("a");

            link.href = url;
            link.download = filename;

            document.body.appendChild(link);

            link.click();

            link.remove();

            window.URL.revokeObjectURL(url);

        } catch (error) {

            console.error(error);

            alert(
                "Unable to download file."
            );

        }

    };

    // ==========================================
    // DOWNLOAD SINGLE MESSAGE ANALYSIS
    // ==========================================

    const handleDownloadSingleMessage = async () => {

        if (!analysisResult) {
            return;
        }

        try {

            await downloadSingleMessageAnalysis(
                analysisResult,
                message
            );

        } catch (error) {

            console.error(error);

            alert(
                "Unable to download analysis."
            );

        }

    };

    // ==========================================
    // CLEAR EVERYTHING
    // ==========================================

    const handleClear = () => {

        setMessage("");
        setSelectedFile(null);
        setAnalysisResult(null);
        setBatchResult(null);

        setSelectedBatchRow(null);
        setDialogOpen(false);

    };

    // ==========================================
    // BATCH RESULT VALUES
    // ==========================================

    const batchRows =
        batchResult?.results ||
        batchResult?.data ||
        [];

    const totalMessages =
        batchResult?.total_messages ??
        batchRows.length;

    const successfulAnalyses =
        batchResult?.successful_analyses ??
        batchRows.length;

    const outputFilename =
        batchResult?.output_filename ||
        batchResult?.filename ||
        "ScamSense_Batch_Message_Analysis.xlsx";

    // ==========================================
    // RETURN
    // ==========================================

    return (
        <>
            <PageHeader
                title="Message Scam Detector"
                description="Detect scam messages using ScamSense AI."
            />

            <div className="mx-auto w-full max-w-[900px] space-y-5">

                {/* ==========================================
                    MESSAGE INPUT
                ========================================== */}

                <MessageInputCard
                    message={message}
                    setMessage={setMessage}

                    selectedFile={selectedFile}
                    setSelectedFile={setSelectedFile}

                    isSingleMessageMode={
                        isSingleMessageMode
                    }

                    isBatchMode={
                        isBatchMode
                    }

                    onAnalyze={
                        handleAnalyze
                    }

                    onAnalyzeDataset={
                        handleAnalyzeDataset
                    }

                    onClear={
                        handleClear
                    }

                    loading={
                        loading
                    }

                    batchLoading={
                        batchLoading
                    }
                />

                {/* ==========================================
                    SINGLE MESSAGE RESULT
                ========================================== */}

                {analysisResult && (
                    <div className="space-y-5">

                        <PredictionCard
                            result={analysisResult}
                        />

                        {/* ==================================
                            DOWNLOAD
                        ================================== */}

                        <div className="flex justify-center rounded-xl border border-border bg-card p-4">

                          <MuiButton
                              variant="contained"
                              size="large"
                              startIcon={<DownloadRounded />}
                              onClick={handleDownloadSingleMessage}
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
                              Download Analysis as Excel
                          </MuiButton>

                      </div>

                        {/* ==================================
                            VERIFICATION
                        ================================== */}

                        <VerificationCard
                            result={analysisResult}
                        />

                        {/* ==================================
                            AI SUMMARY
                        ================================== */}

                        <InfoCard
                            title="AI Summary"
                            content={
                                analysisResult.summary
                            }
                        />

                        {/* ==================================
                            WHY SUSPICIOUS
                        ================================== */}

                        <InfoCard
                            title={
                                analysisResult.predicted_scam_type ===
                                "Legitimate"
                                    ? "Why This Message Appears Legitimate"
                                    : "Why Suspicious?"
                            }
                            content={
                                analysisResult.why_suspicious
                            }
                        />

                        {/* ==================================
                            BULLET RESULTS
                        ================================== */}

                        <div className="grid gap-5 md:grid-cols-2">

                            <BulletCard
                                title="Scam Indicators"
                                items={
                                    analysisResult.scam_indicators
                                }
                            />

                            <BulletCard
                                title="Safety Advice"
                                items={
                                    analysisResult.safety_advice
                                }
                            />

                            <BulletCard
                                title="Recommended Actions"
                                items={
                                    analysisResult.recommended_actions
                                }
                            />

                            <BulletCard
                                title="Prevention Tips"
                                items={
                                    analysisResult.prevention_tips
                                }
                            />

                        </div>

                    </div>
                )}

                {/* ==========================================
                    BATCH RESULT
                ========================================== */}

                {batchResult && (
                    <div className="space-y-5">

                        <BatchSummaryCard
                            filename={
                                outputFilename
                            }

                            totalMessages={
                                totalMessages
                            }

                            successfulAnalyses={
                                successfulAnalyses
                            }

                            onDownload={() =>
                                handleDownloadDataset(
                                    outputFilename
                                )
                            }
                        />

                        <BatchVerificationSummary
                            rows={batchRows}
                        />

                        <BatchResultsTable
                            rows={batchRows}
                            selectedRow={
                                selectedBatchRow
                            }
                            setSelectedRow={
                                setSelectedBatchRow
                            }
                            dialogOpen={
                                dialogOpen
                            }
                            setDialogOpen={
                                setDialogOpen
                            }
                        />

                    </div>
                )}

            </div>

            {/* ==========================================
                SINGLE MESSAGE PROCESSING
            ========================================== */}

            <ProcessingDialog
                open={loading}
            />

            {/* ==========================================
                BATCH PROCESSING
            ========================================== */}

            <BatchProcessingDialog
                open={batchLoading}
            />

            {/* ==========================================
                FOOTER
            ========================================== */}

            <footer className="mx-auto mt-8 max-w-[900px] border-t border-border py-3.5">

                <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">

                    <Info
                        className="mt-0.5 size-3.5 shrink-0"
                        aria-hidden="true"
                    />

                    ScamSense uses AI to identify possible
                    scam indicators, but results may not be
                    100% accurate. When in doubt, verify
                    through official sources.

                </p>

            </footer>
        </>
    );
}

export default MessageScanPage;