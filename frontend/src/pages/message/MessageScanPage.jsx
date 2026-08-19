import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/providers/auth-provider";

import {saveMessageScan, getMessageScanHistory,} from "@/services/message-scan-service";

import {saveMessageBatch, getMessageBatchHistory,} from "@/services/message-batch-service";

import OCRTextDialog from "./components/common/OCRTextDialog";

import {
    DownloadRounded,
    Info,
    VisibilityRounded,
    HistoryRounded,
    DescriptionRounded,
    RefreshRounded,
} from "@mui/icons-material";



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


function MessageScanPage({
    initialMessage = null,
    onInitialMessageConsumed,
    initialFile = null,
    onInitialFileConsumed,
    initialImage = null,
    onInitialImageConsumed,
}) {

    const { user } = useAuth();

    const historyRef = useRef(null);

    const [messageHistory, setMessageHistory] = useState([]);
    const [batchHistory, setBatchHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // ==========================================
    // SINGLE MESSAGE STATE
    // ==========================================

    const [message, setMessage] = useState("");


    // ==========================================
    // OCR STATE
    // ==========================================

    const [ocrDialogOpen, setOcrDialogOpen] = useState(false);

    const [ocrImageFile, setOcrImageFile] = useState(null);

    const [ocrImagePreviewUrl, setOcrImagePreviewUrl] = useState(null);


    // ==========================================
    // ASSISTANT MESSAGE HANDOFF
    // ==========================================

    useEffect(() => {

        if (!initialMessage) {
            return;
        }

        setMessage(initialMessage);

        onInitialMessageConsumed?.();

    }, [initialMessage, onInitialMessageConsumed]);



    // ==========================================
    // BATCH DATASET STATE
    // ==========================================

    const [selectedFile, setSelectedFile] = useState(null);


    // ==========================================
    // ASSISTANT EXCEL FILE HANDOFF
    // ==========================================

    useEffect(() => {

        if (!initialFile) {
            return;
        }

        // Switch to batch mode
        setMessage("");

        setSelectedFile(initialFile);

        // Clear any previous results
        setAnalysisResult(null);
        setBatchResult(null);
        setSelectedBatchRow(null);
        setDialogOpen(false);

        // Tell App.jsx that the file has been consumed
        onInitialFileConsumed?.();

    }, [
        initialFile,
        onInitialFileConsumed,
    ]);


    // ==========================================
    // ANALYSIS RESULT
    // ==========================================

    const [analysisResult, setAnalysisResult] = useState(null);


    // ==========================================
    // LOADING STATE
    // ==========================================

    const [loading, setLoading] = useState(false);

    const [batchLoading, setBatchLoading] = useState(false);


    // ==========================================
    // BATCH RESULT
    // ==========================================

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
// MULTIPLE MESSAGE DETECTION
// ==========================================

const detectMessageCount = (text) => {

    // ------------------------------------------
    // No input
    // ------------------------------------------

    if (!text?.trim()) {
        return 0;
    }


    const normalizedText =
        text.trim();


    let detectedCount = 1;


    // ==========================================
    // 1. EXPLICIT MESSAGE LABELS
    //
    // Supports:
    //
    // Message 1:
    // Message 2:
    //
    // msg 1:
    // msg 2:
    //
    // SMS 1:
    // SMS 2:
    //
    // Email 1:
    // Email 2:
    //
    // WhatsApp 1:
    // WhatsApp 2:
    //
    // Also supports:
    //
    // msg1:
    // msg2:
    //
    // msg #1:
    // msg #2:
    // ==========================================

    const messageLabels =
        normalizedText.match(
            /(?:^|\n)\s*(?:message|msg|sms|email|whatsapp)\s*(?:#?\s*)?\d+\s*:/gi
        );


    if (
        messageLabels &&
        messageLabels.length >= 2
    ) {

        detectedCount =
            Math.max(
                detectedCount,
                messageLabels.length
            );

    }


    // ==========================================
    // 2. NUMBERED MESSAGE FORMAT
    //
    // Supports:
    //
    // 1. Message
    // 2. Message
    //
    // 1.Message
    // 2.Message
    //
    // 1) Message
    // 2) Message
    //
    // 1)Message
    // 2)Message
    //
    // 1: Message
    // 2: Message
    //
    // 1:Message
    // 2:Message
    // ==========================================

    const numberedMessages =
        normalizedText.match(
            /(?:^|\n)\s*\d+\s*[.):]\s*\S+/g
        );


    if (
        numberedMessages &&
        numberedMessages.length >= 2
    ) {

        detectedCount =
            Math.max(
                detectedCount,
                numberedMessages.length
            );

    }


    // ==========================================
    // 3. REPEATED EMAIL SUBJECT HEADERS
    //
    // Example:
    //
    // Subject: Your account requires verification
    //
    // ...
    //
    // Subject: Your parcel requires attention
    //
    // ...
    // ==========================================

    const subjectHeaders =
        normalizedText.match(
            /(?:^|\n)\s*Subject\s*:/gi
        );


    if (
        subjectHeaders &&
        subjectHeaders.length >= 2
    ) {

        detectedCount =
            Math.max(
                detectedCount,
                subjectHeaders.length
            );

    }


    // ==========================================
    // 4. REPEATED FROM HEADERS
    //
    // Example:
    //
    // From: DBS Security Team
    //
    // ...
    //
    // From: SingPost Delivery
    //
    // ...
    // ==========================================

    const fromHeaders =
        normalizedText.match(
            /(?:^|\n)\s*From\s*:/gi
        );


    if (
        fromHeaders &&
        fromHeaders.length >= 2
    ) {

        detectedCount =
            Math.max(
                detectedCount,
                fromHeaders.length
            );

    }


    // ==========================================
    // 5. EXPLICIT SEPARATOR LINES
    //
    // Supports:
    //
    // --------------------
    // ====================
    // ********************
    //
    // At least 3 separator
    // characters are required.
    // ==========================================

    const separatorLines =
        normalizedText.match(
            /(?:^|\n)\s*[-=*]{3,}\s*(?:\n|$)/g
        );


    if (
        separatorLines &&
        separatorLines.length >= 1
    ) {

        detectedCount =
            Math.max(
                detectedCount,
                separatorLines.length + 1
            );

    }


    // ==========================================
    // 6. DETECT EMAIL STRUCTURE
    //
    // We use this to prevent normal email
    // bullet points from being treated as
    // separate messages.
    // ==========================================

    const hasEmailGreeting =
        /(?:^|\n)\s*(?:Dear\s+[^,\n]+,|Hi\s+[^,\n]+,|Hello\s+[^,\n]+,)/i
            .test(normalizedText);


    const hasEmailSignoff =
        /(?:^|\n)\s*(?:Thank\s+you|Thanks|Regards|Best\s+regards|Kind\s+regards|Sincerely)[,\s]*$/i
            .test(normalizedText);


    const hasSubject =
        /(?:^|\n)\s*Subject\s*:/i
            .test(normalizedText);


    const looksLikeEmail =
        hasEmailGreeting ||
        hasEmailSignoff ||
        hasSubject;


    // ==========================================
    // 7. BULLET-POINT MESSAGES
    //
    // Supports:
    //
    // - Message
    // - Message
    //
    // -Message
    // -Message
    //
    // * Message
    // * Message
    //
    // *Message
    // *Message
    //
    // • Message
    // • Message
    //
    // •Message
    // •Message
    //
    // IMPORTANT:
    //
    // We only perform this check when the
    // input does NOT look like a normal email.
    //
    // This prevents:
    //
    // Dear Customer,
    //
    // - Your account is safe.
    // - Your transaction is complete.
    //
    // from being incorrectly detected as
    // multiple messages.
    // ==========================================

    if (!looksLikeEmail) {

        const bulletMessages =
            normalizedText.match(
                /(?:^|\n)\s*[-*•]\s*\S+/g
            );


        if (
            bulletMessages &&
            bulletMessages.length >= 2
        ) {

            detectedCount =
                Math.max(
                    detectedCount,
                    bulletMessages.length
                );

        }

    }


    // ==========================================
    // RETURN RESULT
    // ==========================================

    return detectedCount;

};


// ==========================================
// DETECTED MESSAGE STATE
// ==========================================

const detectedMessageCount =
    detectMessageCount(message);


const hasMultipleMessages =
    detectedMessageCount > 1;

    // ==========================================
    // ANALYZE SINGLE MESSAGE
    // ==========================================

    const handleAnalyze = async () => {

        if (!message.trim()) {
            return;
        }

        if (hasMultipleMessages) {
        return;
    }

        try {

            setLoading(true);

            setAnalysisResult(null);

            setBatchResult(null);


            // ==========================================
            // 1. RUN MESSAGE SCAM DETECTOR
            // ==========================================

            const result =
                await analyzeMessage(message);


            // ==========================================
            // 2. DISPLAY RESULT
            // ==========================================

            setAnalysisResult(result);


            // ==========================================
            // 3. SAVE ANALYSIS TO SUPABASE
            // ==========================================

            if (user) {

                try {

                    await saveMessageScan({
                        userId: user.id,
                        inputMessage: message,
                        analysisResult: result,
                    });

                    await loadHistory();

                    console.log(
                        "Message analysis saved to Supabase."
                    );

                } catch (saveError) {

                    console.error(
                        "Failed to save message analysis to Supabase:",
                        saveError
                    );

                }

            }

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


            // ==========================================
            // 1. RUN BATCH MESSAGE DETECTOR
            // ==========================================

            const result =
                await analyzeDataset(selectedFile);


            // ==========================================
            // 2. DISPLAY BATCH RESULT
            // ==========================================

            setBatchResult(result);


            // ==========================================
            // 3. DETERMINE BATCH RESULT ROWS
            // ==========================================

            const rows =
                result?.results ||
                result?.data ||
                [];


            const totalMessages =
                result?.total_messages ??
                rows.length;


            const successfulAnalyses =
                result?.successful_analyses ??
                rows.length;


            const outputFilename =
                result?.output_filename ||
                result?.filename ||
                selectedFile?.name ||
                "ScamSense_Batch_Message_Analysis.xlsx";


            // ==========================================
            // 4. SAVE BATCH HISTORY TO SUPABASE
            // ==========================================

            if (user) {

                try {

                    await saveMessageBatch({
                        userId: user.id,

                        filename:
                            selectedFile?.name ||
                            outputFilename,

                        totalMessages:
                            totalMessages,

                        successfulAnalyses:
                            successfulAnalyses,

                        analysisResults:
                            rows,
                    });

                    await loadHistory();


                    console.log(
                        "Batch analysis saved to Supabase."
                    );

                } catch (saveError) {

                    // Supabase failure should NOT
                    // make the detector fail.

                    console.error(
                        "Failed to save batch analysis to Supabase:",
                        saveError
                    );

                }

            }

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
    // Load Message Scam Feature History
    // ==========================================

    const loadHistory = async () => {

    if (!user) {
        setMessageHistory([]);
        setBatchHistory([]);
        return;
    }

    try {

        setHistoryLoading(true);

        const [
            messageHistoryData,
            batchHistoryData,
        ] = await Promise.all([
            getMessageScanHistory(user.id, 20),
            getMessageBatchHistory(user.id, 20),
        ]);

        setMessageHistory(
            messageHistoryData
        );

        setBatchHistory(
            batchHistoryData
        );

    } catch (error) {

        console.error(
            "Failed to load message scan history:",
            error
        );

    } finally {

        setHistoryLoading(false);

    }
};

useEffect(() => {

    loadHistory();

}, [user?.id]);

    // ==========================================
    // Single message restore function
    // ==========================================

const handleOpenMessageHistory = (historyItem) => {

    const savedMessage =
        historyItem.input_message;

    const savedAnalysis =
        historyItem.analysis_result;

    setSelectedFile(null);

    setBatchResult(null);

    setSelectedBatchRow(null);

    setDialogOpen(false);

    setMessage(savedMessage);

    setAnalysisResult(savedAnalysis);

    window.scrollTo({
        top: 0,
        behavior: "smooth",
    });
};

    // ==========================================
    // Batch restore function 
    // ==========================================

const handleOpenBatchHistory = (historyItem) => {

    const restoredRows =
        historyItem.analysis_results || [];

    setMessage("");

    setAnalysisResult(null);

    setSelectedFile(null);

    setSelectedBatchRow(null);

    setDialogOpen(false);

    setBatchResult({
        results: restoredRows,

        total_messages:
            historyItem.total_messages,

        successful_analyses:
            historyItem.successful_analyses,

        filename:
            historyItem.filename,

        output_filename:
            historyItem.filename,
    });

    window.scrollTo({
        top: 0,
        behavior: "smooth",
    });
};

// scroll to view history section
const handleViewHistory = () => {
    historyRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
    });
};


const handleOpenOCR = (file) => {

    if (!file) {
        return;
    }


    // Clean up previous preview URL

    if (ocrImagePreviewUrl) {

        URL.revokeObjectURL(
            ocrImagePreviewUrl
        );

    }


    const previewUrl =
        URL.createObjectURL(file);


    setOcrImageFile(file);

    setOcrImagePreviewUrl(
        previewUrl
    );

    setOcrDialogOpen(true);

};

const handleCloseOCR = () => {

    setOcrDialogOpen(false);

};


const handleUseOCRText = (text) => {

    setMessage(text);

    setSelectedFile(null);

    setAnalysisResult(null);

    setBatchResult(null);

    setOcrDialogOpen(false);

};

// ==========================================
// ASSISTANT OCR IMAGE HANDOFF
// ==========================================

useEffect(() => {
    if (!initialImage) {
        return;
    }

    // Open the OCR dialog automatically
    handleOpenOCR(initialImage);

    // Tell App.jsx the image handoff has been consumed
    onInitialImageConsumed?.();

}, [
    initialImage,
    onInitialImageConsumed,
]);


    // ==========================================
    // RETURN
    // ==========================================

    return (
        <>
              <div className="mx-auto mb-5 w-full max-w-[1350px] px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold text-primary sm:text-3xl">
                  Message Scam Detector
              </h1>

                <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                  Detect scam messages using ScamSense AI.
              </p>
            </div>

            {user && (
                        <MuiButton
            variant="outlined"
            size="small"
            startIcon={<HistoryRounded />}
            onClick={handleViewHistory}
            sx={{
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 600,
                whiteSpace: "nowrap",

                px: 2,
                py: 0.9,

                color: "#1976D2",
                borderColor: "#1976D2",

                "&:hover": {
                    borderColor: "#1565C0",
                    backgroundColor: "rgba(25, 118, 210, 0.06)",
                },
            }}
        >
            View History
        </MuiButton>
            )}
        </div>
    </div>


            <div className="mx-auto w-full max-w-[900px] space-y-5">


                {/* ==========================================
                    MESSAGE INPUT
                ========================================== */}

                <MessageInputCard
    message={message}
    setMessage={setMessage}
    onOpenOCR={handleOpenOCR}

    selectedFile={selectedFile}
    setSelectedFile={setSelectedFile}

    isSingleMessageMode={isSingleMessageMode}
    isBatchMode={isBatchMode}

    hasMultipleMessages={hasMultipleMessages}
    detectedMessageCount={detectedMessageCount}

    onAnalyze={handleAnalyze}
    onAnalyzeDataset={handleAnalyzeDataset}
    onClear={handleClear}

    loading={loading}
    batchLoading={batchLoading}
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

                                startIcon={
                                    <DownloadRounded />
                                }

                                onClick={
                                    handleDownloadSingleMessage
                                }

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

            {/* ==========================================
                MESSAGE SCAN HISTORY
              ========================================== */}

          {user && (
                <div
                    ref={historyRef}
                    className="mt-8 scroll-mt-6 space-y-5"
                >

                  {/* ==========================================
                      HISTORY HEADER
                  ========================================== */}

                  <div className="flex items-center justify-between">

                      <div>

                          <div className="flex items-center gap-2">

                              <HistoryRounded
                                  className="text-primary"
                              />

                              <h2 className="text-xl font-bold text-foreground">
                                  Scan History
                              </h2>

                          </div>

                          <p className="mt-1 text-sm text-muted-foreground">
                              View your previous message analyses
                              and batch uploads.
                          </p>

                      </div>


                      <MuiButton
                          variant="outlined"
                          startIcon={
                              <RefreshRounded />
                          }
                          onClick={loadHistory}
                          disabled={historyLoading}
                          sx={{
                              borderRadius: 2,
                              textTransform: "none",
                              fontWeight: 600,
                          }}
                      >
                          Refresh
                      </MuiButton>

                  </div>


        {/* ==========================================
            SINGLE MESSAGE HISTORY
        ========================================== */}

        <div className="overflow-hidden rounded-xl border border-border bg-card">

            <div className="border-b border-border px-5 py-4">

                <div className="flex items-center gap-2">

                    <DescriptionRounded />

                    <h3 className="font-bold">
                        Previous Message Scans
                    </h3>

                </div>

            </div>


            {historyLoading ? (

                <div className="px-5 py-8 text-center text-sm text-muted-foreground">

                    Loading scan history...

                </div>

            ) : messageHistory.length === 0 ? (

                <div className="px-5 py-8 text-center text-sm text-muted-foreground">

                    You have no previous message scans.

                </div>

            ) : (

                <div className="overflow-x-auto">

                    <table className="w-full text-sm">

                        <thead>

                            <tr className="border-b border-border bg-muted/40">

                                <th className="px-5 py-3 text-left font-semibold">
                                    Message
                                </th>

                                <th className="px-5 py-3 text-left font-semibold">
                                    Scam Type
                                </th>

                                <th className="px-5 py-3 text-left font-semibold">
                                    Risk
                                </th>

                                <th className="px-5 py-3 text-left font-semibold">
                                    Date
                                </th>

                                <th className="px-5 py-3 text-right font-semibold">
                                    Action
                                </th>

                            </tr>

                        </thead>


                        <tbody>

                            {messageHistory.map(
                                (item) => {

                                    const analysis =
                                        item.analysis_result || {};

                                    return (

                                        <tr
                                            key={item.id}
                                            className="border-b border-border last:border-b-0 hover:bg-muted/20"
                                        >

                                            <td className="max-w-[300px] px-5 py-4">

                                                <p
                                                    className="truncate"
                                                    title={
                                                        item.input_message
                                                    }
                                                >
                                                    {
                                                        item.input_message
                                                    }
                                                </p>

                                            </td>


                                            <td className="px-5 py-4">

                                                {
                                                    analysis.predicted_scam_type ||
                                                    "Unknown"
                                                }

                                            </td>


                                            <td className="px-5 py-4">

                                                <span className="font-semibold">

                                                    {
                                                        analysis.risk_level ||
                                                        "Unknown"
                                                    }

                                                </span>

                                            </td>


                                            <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">

                                                {
                                                    new Date(
                                                        item.created_at
                                                    ).toLocaleString()
                                                }

                                            </td>


                                            <td className="px-5 py-4 text-right">

                                                <MuiButton
                                                    variant="outlined"
                                                    size="small"
                                                    startIcon={
                                                        <VisibilityRounded />
                                                    }
                                                    onClick={() =>
                                                        handleOpenMessageHistory(
                                                            item
                                                        )
                                                    }
                                                    sx={{
                                                        borderRadius: 2,
                                                        textTransform: "none",
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    View Analysis
                                                </MuiButton>

                                            </td>

                                        </tr>

                                    );

                                }
                            )}

                        </tbody>

                    </table>

                </div>

            )}

        </div>


        {/* ==========================================
            BATCH HISTORY
        ========================================== */}

        <div className="overflow-hidden rounded-xl border border-border bg-card">

            <div className="border-b border-border px-5 py-4">

                <div className="flex items-center gap-2">

                    <DescriptionRounded />

                    <h3 className="font-bold">
                        Previous Batch Analyses
                    </h3>

                </div>

            </div>


            {historyLoading ? (

                <div className="px-5 py-8 text-center text-sm text-muted-foreground">

                    Loading batch history...

                </div>

            ) : batchHistory.length === 0 ? (

                <div className="px-5 py-8 text-center text-sm text-muted-foreground">

                    You have no previous batch analyses.

                </div>

            ) : (

                <div className="overflow-x-auto">

                    <table className="w-full text-sm">

                        <thead>

                            <tr className="border-b border-border bg-muted/40">

                                <th className="px-5 py-3 text-left font-semibold">
                                    File
                                </th>

                                <th className="px-5 py-3 text-left font-semibold">
                                    Messages
                                </th>

                                <th className="px-5 py-3 text-left font-semibold">
                                    Analysed
                                </th>

                                <th className="px-5 py-3 text-left font-semibold">
                                    Date
                                </th>

                                <th className="px-5 py-3 text-right font-semibold">
                                    Action
                                </th>

                            </tr>

                        </thead>


                        <tbody>

                            {batchHistory.map(
                                (item) => (

                                    <tr
                                        key={item.id}
                                        className="border-b border-border last:border-b-0 hover:bg-muted/20"
                                    >

                                        <td className="px-5 py-4">

                                            <div className="flex items-center gap-2">

                                                <DescriptionRounded
                                                    fontSize="small"
                                                />

                                                <span className="font-medium">

                                                    {
                                                        item.filename
                                                    }

                                                </span>

                                            </div>

                                        </td>


                                        <td className="px-5 py-4">

                                            {
                                                item.total_messages
                                            }

                                        </td>


                                        <td className="px-5 py-4">

                                            {
                                                item.successful_analyses
                                            }

                                        </td>


                                        <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">

                                            {
                                                new Date(
                                                    item.created_at
                                                ).toLocaleString()
                                            }

                                        </td>


                                        <td className="px-5 py-4 text-right">

                                            <MuiButton
                                                variant="outlined"
                                                size="small"
                                                startIcon={
                                                    <VisibilityRounded />
                                                }
                                                onClick={() =>
                                                    handleOpenBatchHistory(
                                                        item
                                                    )
                                                }
                                                sx={{
                                                    borderRadius: 2,
                                                    textTransform: "none",
                                                    fontWeight: 600,
                                                }}
                                            >
                                                View Batch
                                            </MuiButton>

                                        </td>

                                    </tr>

                                )
                            )}

                        </tbody>

                    </table>

                </div>

            )}

        </div>

    </div>

)}

            <ProcessingDialog
                open={loading}
            />

            {/* ==========================================
                BATCH PROCESSING
            ========================================== */}

              <BatchProcessingDialog
                  open={batchLoading}
              />

              <OCRTextDialog

      open={ocrDialogOpen}

      imageFile={ocrImageFile}

      imagePreviewUrl={
          ocrImagePreviewUrl
      }

      onClose={
          handleCloseOCR
      }

      onUseText={
          handleUseOCRText
      }

      onSelectNewImage={(newFile) => {
    setOcrImageFile(newFile)

    const newPreviewUrl = URL.createObjectURL(newFile)

    setOcrImagePreviewUrl((current) => {
        if (current) {
            URL.revokeObjectURL(current)
        }

        return newPreviewUrl
    })
}}

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