import axios from "axios";

const api = axios.create({

    baseURL: import.meta.env.VITE_API_BASE_URL

});


/* ==========================================
   Analyze Single Message
========================================== */

export const analyzeMessage = async (message) => {

    const response = await api.post(

        "/api/message/analyze-message",

        {

            message

        }

    );

    return response.data;

};


/* ==========================================
   Analyze Excel Dataset for batch message analysis
========================================== */

export const analyzeDataset = async (file) => {

    const formData = new FormData();

    formData.append(
        "file",
        file
    );

    const response = await api.post(

        "/api/batch/analyze-dataset",

        formData,

        {

            headers: {

                "Content-Type": "multipart/form-data"

            }

        }

    );

    return response.data;

};


/* ==========================================
   Download Generated Excel Dataset
   for batch message analysis
========================================== */

export const downloadDataset = async (filename) => {

    const response = await api.get(

        `/api/batch/download/${filename}`,

        {

            responseType: "blob"

        }

    );

    return response;

};


/* ==========================================
   Download Excel for single message analysis
========================================== */

export const downloadSingleMessageAnalysis = async (
    result,
    message
) => {

    const XLSX = await import("xlsx-js-style");

    const verification =
        result.verification || {};


    // ==========================================
    // Format long text for Excel
    // ==========================================

    const formatTextForExcel = (text) => {

        if (!text) {

            return "";

        }

        const MAX_LINE_LENGTH = 80;


        const wrapLine = (line) => {

            const words =
                line
                    .trim()
                    .split(/\s+/);

            const lines = [];

            let currentLine = "";


            words.forEach((word) => {

                if (
                    currentLine.length === 0
                ) {

                    currentLine = word;

                }

                else if (
                    currentLine.length +
                    word.length +
                    1 <=
                    MAX_LINE_LENGTH
                ) {

                    currentLine +=
                        " " + word;

                }

                else {

                    lines.push(
                        currentLine
                    );

                    currentLine = word;

                }

            });


            if (currentLine) {

                lines.push(
                    currentLine
                );

            }


            return lines.join("\n");

        };


        return text

            // Preserve existing paragraphs
            .split(/\r?\n+/)

            .map(
                paragraph =>
                    wrapLine(paragraph)
            )

            .join("\n\n")

            .trim();

    };


    // ==========================================
    // Format list values
    // ==========================================

    const formatList = (items) => {

        if (!Array.isArray(items)) {

            return formatTextForExcel(
                items || ""
            );

        }


        return items

            .map(
                (item, index) =>
                    `${index + 1}. ${item}`
            )

            .map(
                item =>
                    formatTextForExcel(item)
            )

            .join("\n\n");

    };


    // ==========================================
    // Confidence Gap
    //
    // Backend already returns:
    // "2.60%"
    //
    // Therefore DO NOT multiply by 100.
    // ==========================================

    const confidenceGap =
        result.confidence_gap || "0.00%";


    // ==========================================
    // Legitimate Message Handling
    // ==========================================

    const isLegitimate =
        result.predicted_scam_type === "Legitimate";


    // ------------------------------------------
    // Dynamic Excel column title
    // ------------------------------------------

    const whyColumnTitle =
        isLegitimate
            ? "Why This Message Appears Legitimate"
            : "Why Suspicious";


    // ------------------------------------------
    // Dynamic explanation
    // ------------------------------------------

    const whyMessage =

        result.why_suspicious ||

        (
            isLegitimate

                ? "This message appears likely to be legitimate based on the characteristics identified by the ScamSense analysis pipeline. No significant scam indicators were identified in the message."

                : "No additional explanation was provided."
        );


    // ------------------------------------------
    // Scam indicators
    // ------------------------------------------

    const scamIndicators =

        isLegitimate

            ? "No scam indicators were identified because this message appears likely to be legitimate."

            : formatList(
                result.scam_indicators
            );


    // ==========================================
    // Cross Verification
    // ==========================================

    const verificationPerformed =
        Boolean(
            verification.performed
        );


    const modelsAgreeing =
        verificationPerformed
            ? Number(
                verification.models_agreeing || 0
            )
            : 0;


    const modelsAvailable =
        verificationPerformed
            ? Number(
                verification.models_available || 0
            )
            : 0;


    const agreementPercentage =
        verificationPerformed
            ? Number(
                verification.agreement_percentage || 0
            )
            : 0;


    // ------------------------------------------
    // Human-readable verification status
    // ------------------------------------------

    const crossVerification =
        verificationPerformed

            ? `Yes - ${modelsAgreeing}/${modelsAvailable} models agreed (${agreementPercentage.toFixed(2)}%)`

            : "No - Not required";


    // ==========================================
    // Build Excel Row
    // ==========================================

    const row = {

        // --------------------------------------
        // Message
        // --------------------------------------

        "Text":
            formatTextForExcel(
                message
            ),


        // --------------------------------------
        // ML Prediction
        // --------------------------------------

        "Predicted Scam Type":
            result.predicted_scam_type || "",


        "Confidence Score (ML Model)":
            result.confidence_score || "",


        "Confidence Level (ML Model Certainty)":
            result.confidence_level || "",


        "Confidence Gap (Top 1 vs Top 2 Model Prediction Score Difference)":
            confidenceGap,


        "Risk Level (Final ScamSense Assessment)":
            result.risk_level || "",


        // --------------------------------------
        // Cross Verification
        // --------------------------------------

        "Cross-Verification (Model Agreement)":
            crossVerification,


        "Models Agreeing":
            modelsAgreeing,


        "Models Available":
            modelsAvailable,


        "Agreement Percentage":
            `${agreementPercentage.toFixed(2)}%`,


        // --------------------------------------
        // Assessment
        // --------------------------------------

        "Confidence Assessment":
            formatTextForExcel(
                result.confidence_assessment || ""
            ),


        "Risk Assessment":
            formatTextForExcel(
                result.risk_assessment || ""
            ),


        // --------------------------------------
        // AI Explanation
        // --------------------------------------

        "AI Summary":
            formatTextForExcel(
                result.summary || ""
            ),


        // --------------------------------------
        // Dynamic Why Suspicious /
        // Why Legitimate
        // --------------------------------------

        [whyColumnTitle]:
            formatTextForExcel(
                whyMessage
            ),


        // --------------------------------------
        // Scam Indicators
        // --------------------------------------

        "Scam Indicators":
            formatTextForExcel(
                scamIndicators
            ),


        // --------------------------------------
        // Safety
        // --------------------------------------

        "Safety Advice":
            formatList(
                result.safety_advice
            ),


        "Recommended Actions":
            formatList(
                result.recommended_actions
            ),


        "Prevention Tips":
            formatList(
                result.prevention_tips
            )

    };


    // ==========================================
    // Create Worksheet
    // ==========================================

    const worksheet =
        XLSX.utils.json_to_sheet(
            [row]
        );


    // ==========================================
    // Excel Header Style
    // ==========================================

    const headerStyle = {

    fill: {

        fgColor: {

            rgb: "6C3BFF"

        }

    },

    font: {

        bold: true,

        color: {

            rgb: "FFFFFF"

        }

    },

    alignment: {

        horizontal: "center",

        vertical: "center",

        wrapText: true

    }

};

    // ==========================================
    // Apply cell formatting
    // ==========================================

    const range =
        XLSX.utils.decode_range(
            worksheet["!ref"]
        );


    for (
        let rowIndex = range.s.r;
        rowIndex <= range.e.r;
        rowIndex++
    ) {

        for (
            let columnIndex = range.s.c;
            columnIndex <= range.e.c;
            columnIndex++
        ) {

            const cellAddress =
                XLSX.utils.encode_cell({

                    r: rowIndex,

                    c: columnIndex

                });


            if (
                worksheet[cellAddress]
            ) {

                // --------------------------------
                // Header
                // --------------------------------

                if (
                    rowIndex === 0
                ) {

                    worksheet[cellAddress].s =
                        headerStyle;

                }

                // --------------------------------
                // Body
                // --------------------------------

                else {

                    worksheet[cellAddress].s = {

                        alignment: {

                            vertical: "top",

                            horizontal: "left",

                            wrapText: true

                        }

                    };

                }

            }

        }

    }


    // ==========================================
    // Create Workbook
    // ==========================================

    const workbook =
        XLSX.utils.book_new();


    XLSX.utils.book_append_sheet(

        workbook,

        worksheet,

        "ScamSense Analysis"

    );


    // ==========================================
    // Column Widths
    // ==========================================

    worksheet["!cols"] = [

        { wch: 55 }, // Text

        { wch: 24 }, // Predicted Scam Type

        { wch: 24 }, // Confidence Score

        { wch: 32 }, // Confidence Level

        { wch: 55 }, // Confidence Gap

        { wch: 35 }, // Risk Level

        { wch: 40 }, // Cross Verification

        { wch: 18 }, // Models Agreeing

        { wch: 18 }, // Models Available

        { wch: 22 }, // Agreement Percentage

        { wch: 65 }, // Confidence Assessment

        { wch: 65 }, // Risk Assessment

        { wch: 65 }, // AI Summary

        { wch: 65 }, // Why Suspicious / Legitimate

        { wch: 60 }, // Scam Indicators

        { wch: 60 }, // Safety Advice

        { wch: 60 }, // Recommended Actions

        { wch: 60 }  // Prevention Tips

    ];


    // ==========================================
    // Row Heights
    // ==========================================

    worksheet["!rows"] = [

        // Header row
        {
            hpt: 35
        },

        // Analysis row
        {
            hpt: 300
        }

    ];


    // ==========================================
    // Download Excel
    // ==========================================

    XLSX.writeFile(

        workbook,

        "ScamSense_Single_Message_Analysis.xlsx"

    );

};


export { default as MessageScanPage } from "./MessageScanPage";