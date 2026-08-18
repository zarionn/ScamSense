import {
    Alert,
    Chip,
    Divider,
    Stack
} from "@mui/material";

import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";


function VerificationCard({ result }) {

    // ==================================================
    // BASIC VALUES
    // ==================================================

    const confidenceText =
        result?.confidence_score || "0.00%";

    const confidence =
        parseFloat(
            confidenceText.replace("%", "")
        ) || 0;

    const confidenceLevel =
        result?.confidence_level || "Unknown";

    const riskLevel =
        result?.risk_level || "Unknown";

    const confidenceGapText =
        result?.confidence_gap || "0.00%";

    const confidenceGap =
        parseFloat(
            confidenceGapText.replace("%", "")
        ) || 0;

    const verification =
        result?.verification || {};

    const performed =
        verification.performed === true;

    const modelsAgreeing =
        verification.models_agreeing ?? 0;

    const modelsAvailable =
        verification.models_available ?? 0;

    const agreementPercentage =
        verification.agreement_percentage ?? 0;


    // ==================================================
    // THRESHOLDS
    // ==================================================

    const LOW_CONFIDENCE_THRESHOLD = 60;

    const HIGH_CONFIDENCE_THRESHOLD = 80;

    const CONFIDENCE_GAP_THRESHOLD = 15;


    // ==================================================
    // MODEL ACCURACY
    // ==================================================

    const modelAccuracy =
        result?.model_accuracy ?? null;


    // ==================================================
    // CONFIDENCE EXPLANATION
    // ==================================================

    let confidenceMessage = "";


    if (confidenceLevel === "Low") {

        confidenceMessage = (
            <>
                The ML model has{" "}
                <strong>
                    low confidence ({confidence.toFixed(2)}%)
                </strong>.
                The confidence score is below the{" "}
                <strong>
                    {LOW_CONFIDENCE_THRESHOLD.toFixed(2)}%
                </strong>{" "}
                low-confidence threshold. Additional internal
                cross-verification is therefore required to provide
                further support for the final classification.
            </>
        );

    }

    else if (confidenceLevel === "Medium") {

        confidenceMessage = (
            <>
                The ML model has{" "}
                <strong>
                    medium confidence ({confidence.toFixed(2)}%)
                </strong>.
                The confidence score is between the low-confidence
                and high-confidence thresholds. Additional internal
                cross-verification is therefore performed to provide
                additional support for the final classification.
            </>
        );

    }

    else if (confidenceLevel === "High") {

        confidenceMessage = (
            <>
                The ML model has{" "}
                <strong>
                    high confidence ({confidence.toFixed(2)}%)
                </strong>.
                The confidence score meets the{" "}
                <strong>
                    {HIGH_CONFIDENCE_THRESHOLD.toFixed(2)}%
                </strong>{" "}
                high-confidence threshold. No additional internal
                cross-verification was required.
            </>
        );

    }

    else {

        confidenceMessage = (
            <>
                The ML model confidence is{" "}
                <strong>
                    {confidence.toFixed(2)}%
                </strong>.
            </>
        );

    }


    // ==================================================
    // VERIFICATION EXPLANATION
    // ==================================================

    let verificationMessage = "";


    if (performed) {

        verificationMessage = (
            <>
                Additional internal cross-verification was{" "}
                <strong>performed</strong> because the ML prediction
                did not satisfy the required confidence criteria.
                The final classification was supported by{" "}
                <strong>
                    {modelsAgreeing} out of {modelsAvailable}
                </strong>{" "}
                independent models, with an agreement of{" "}
                <strong>
                    {agreementPercentage.toFixed(2)}%
                </strong>.
            </>
        );

    }

    else {

        verificationMessage = (
            <>
                Additional internal cross-verification was{" "}
                <strong>not required</strong> because the ML
                prediction satisfied the required confidence
                criteria.
            </>
        );

    }


    // ==================================================
    // CONFIDENCE GAP
    // ==================================================

    const confidenceGapMessage = (
        <>
            The difference between the{" "}
            <strong>
                Top 1 and Top 2 model prediction scores
            </strong>{" "}
            was{" "}
            <strong>
                {confidenceGap.toFixed(2)}%
            </strong>.
            The required confidence gap threshold is{" "}
            <strong>
                {CONFIDENCE_GAP_THRESHOLD.toFixed(2)}%
            </strong>{" "}
            for the prediction to be considered sufficiently
            separated from the second-highest prediction.
        </>
    );


    // ==================================================
    // RISK
    // ==================================================

    const riskMessage = (
        <>
            The final ScamSense risk level is{" "}
            <strong>
                {riskLevel}
            </strong>.
            This represents the final risk assessment produced
            by the ScamSense detection pipeline after considering
            the ML prediction and, where required, internal
            cross-verification.
        </>
    );


    // ==================================================
    // MODEL ACCURACY
    // ==================================================

    let modelAccuracyMessage = null;


    if (modelAccuracy !== null) {

        modelAccuracyMessage = (
            <>
                The ML model has an overall accuracy of{" "}
                <strong>
                    {Number(modelAccuracy).toFixed(2)}%
                </strong>.
                The required minimum model accuracy is{" "}
                <strong>
                    {HIGH_CONFIDENCE_THRESHOLD.toFixed(2)}%
                </strong>.

                {Number(modelAccuracy) >= HIGH_CONFIDENCE_THRESHOLD
                    ? (
                        <>
                            {" "}The model therefore meets the required
                            accuracy criterion.
                        </>
                    )
                    : (
                        <>
                            {" "}The model does not meet the required
                            accuracy criterion, so additional verification
                            may be required.
                        </>
                    )
                }

            </>
        );

    }


    return (

        <div
            className="
                mt-3
                rounded-xl
                border
                border-border
                bg-card
                p-6
                text-card-foreground
            "
        >

            {/* ==========================================
                TITLE
            ========================================== */}

            <div className="mb-4 flex items-center gap-2">

                <VerifiedRoundedIcon
                    sx={{
                        color: "var(--primary)"
                    }}
                />

                <h2 className="text-lg font-bold text-foreground">
                    ScamSense Verification
                </h2>

            </div>


            {/* ==========================================
                CONFIDENCE ALERT
            ========================================== */}

            <Alert
                severity={
                    confidenceLevel === "Low"
                        ? "warning"
                        : confidenceLevel === "Medium"
                            ? "info"
                            : confidenceLevel === "High"
                                ? "success"
                                : "info"
                }
                icon={
                    confidenceLevel === "Low"
                        ? <WarningAmberRoundedIcon />
                        : <InfoRoundedIcon />
                }
                sx={{

                    mb: 3,

                    backgroundColor:
                        confidenceLevel === "Low"
                            ? "color-mix(in oklch, #F59E0B 10%, transparent)"
                            : confidenceLevel === "High"
                                ? "color-mix(in oklch, #22C55E 10%, transparent)"
                                : "color-mix(in oklch, var(--primary) 8%, transparent)",

                    color:
                        "var(--foreground)",

                    border:
                        "1px solid var(--border)"

                }}
            >

                <div className="font-semibold text-foreground">
                    {confidenceMessage}
                </div>

            </Alert>


            {/* ==========================================
                ASSESSMENT DETAILS
            ========================================== */}

            <div
                className="
                    rounded-xl
                    border
                    border-border
                    bg-muted/40
                    p-6
                "
            >

                <h3 className="mb-5 text-lg font-bold text-foreground">
                    Assessment Details
                </h3>


                {/* Confidence */}

                <div className="mb-5">

                    <h4 className="mb-1 font-bold text-foreground">
                        Confidence Assessment
                    </h4>

                    <p className="text-sm leading-7 text-muted-foreground">
                        {confidenceMessage}
                    </p>

                </div>


                {/* Confidence Gap */}

                <div className="mb-5">

                    <h4 className="mb-1 font-bold text-foreground">
                        Confidence Gap
                    </h4>

                    <p className="text-sm leading-7 text-muted-foreground">
                        {confidenceGapMessage}
                    </p>

                </div>


                {/* Model Accuracy */}

                {modelAccuracyMessage && (

                    <div className="mb-5">

                        <h4 className="mb-1 font-bold text-foreground">
                            Model Accuracy
                        </h4>

                        <p className="text-sm leading-7 text-muted-foreground">
                            {modelAccuracyMessage}
                        </p>

                    </div>

                )}


                {/* Verification */}

                <div className="mb-5">

                    <h4 className="mb-1 font-bold text-foreground">
                        Internal Cross-Verification
                    </h4>

                    <p className="text-sm leading-7 text-muted-foreground">
                        {verificationMessage}
                    </p>

                </div>


                {/* Risk */}

                <div>

                    <h4 className="mb-1 font-bold text-foreground">
                        Risk Assessment
                    </h4>

                    <p className="text-sm leading-7 text-muted-foreground">
                        {riskMessage}
                    </p>

                </div>

            </div>


            {/* ==========================================
                METRICS
            ========================================== */}

            <Stack
                direction="row"
                spacing={1}
                flexWrap="wrap"
                useFlexGap
                sx={{
                    mt: 2
                }}
            >

                <Chip
                    label={`Confidence: ${confidenceText}`}
                    variant="outlined"
                    sx={{
                        fontWeight: 600,
                        color: "var(--primary)",
                        borderColor:
                            "color-mix(in oklch, var(--primary) 50%, transparent)",
                        backgroundColor:
                            "color-mix(in oklch, var(--primary) 8%, transparent)"
                    }}
                />


                <Chip
                    label={`Confidence Level: ${confidenceLevel}`}
                    variant="outlined"
                    sx={{
                        fontWeight: 600,

                        color:
                            confidenceLevel === "High"
                                ? "#2E7D32"
                                : confidenceLevel === "Medium"
                                    ? "#1565C0"
                                    : confidenceLevel === "Low"
                                        ? "#E65100"
                                        : "var(--muted-foreground)",

                        borderColor:
                            "var(--border)",

                        backgroundColor:
                            "var(--muted)"
                    }}
                />


                <Chip
                    label={
                        `Confidence Gap: ${confidenceGap.toFixed(2)}%`
                    }
                    variant="outlined"
                    sx={{
                        fontWeight: 600,
                        color: "#1565C0",
                        borderColor: "#90CAF9",
                        backgroundColor:
                            "color-mix(in oklch, #2196F3 8%, transparent)"
                    }}
                />


                <Chip
                    label={`Risk Level: ${riskLevel}`}
                    variant="outlined"
                    sx={{
                        fontWeight: 600,
                        color:
                            riskLevel === "High"
                                ? "#C62828"
                                : riskLevel === "Medium"
                                    ? "#E65100"
                                    : riskLevel === "Low"
                                        ? "#2E7D32"
                                        : "var(--muted-foreground)",

                        borderColor:
                            "var(--border)",

                        backgroundColor:
                            "var(--muted)"
                    }}
                />


                {performed && (

                    <Chip
                        label={
                            `Agreement: ${agreementPercentage.toFixed(2)}%`
                        }
                        variant="outlined"
                        sx={{
                            fontWeight: 600,
                            color: "#2E7D32",
                            borderColor: "#81C784",
                            backgroundColor:
                                "color-mix(in oklch, #22C55E 8%, transparent)"
                        }}
                    />

                )}

            </Stack>


            {/* ==========================================
                MODEL AGREEMENT
            ========================================== */}

            {performed && (

                <>

                    <Divider
                        sx={{
                            my: 2,
                            borderColor:
                                "var(--border)"
                        }}
                    />

                    <p className="text-sm leading-7 text-muted-foreground">

                        Internal verification found that{" "}

                        <strong className="text-foreground">
                            {modelsAgreeing} out of {modelsAvailable}
                        </strong>{" "}

                        available models supported the final
                        classification of{" "}

                        <strong className="text-foreground">
                            "{result?.predicted_scam_type}"
                        </strong>
                        , with an overall agreement of{" "}

                        <strong className="text-foreground">
                            {agreementPercentage.toFixed(2)}%
                        </strong>.

                    </p>

                </>

            )}

        </div>

    );

}

export default VerificationCard;