import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    Grid,
    Chip
} from "@mui/material";

import InfoCard from "../result/InfoCard";
import BulletCard from "../result/BulletCard";


function BatchAnalysisDialog({
    open,
    row,
    onClose
}) {

    if (!row) {
        return null;
    }


    const isLegitimate =
        row["Predicted Scam Type"] === "Legitimate";


    const whyTitle =
        isLegitimate
            ? "Why This Message Appears Legitimate"
            : "Why Suspicious";


    // ==========================================
    // Convert batch text fields into arrays
    // ==========================================

    const formatBulletItems = (value) => {

        if (!value) {
            return [];
        }


        if (typeof value === "string") {

            return value
                .split("\n")
                .map(item => item.trim())
                .filter(item => item !== "");

        }


        if (Array.isArray(value)) {
            return value;
        }


        return [];

    };


    // ==========================================
    // Extract batch analysis information
    // ==========================================

    const scamType =
        row["Predicted Scam Type"] || "Unknown";


    const confidence =
        row["Confidence Score (ML Model)"] || "N/A";


    const confidenceLevel =
        row["Confidence Level (ML Model Certainty)"] || "N/A";


    const confidenceGapRaw =
        row[
            "Confidence Gap (Top 1 vs Top 2 Model Prediction Score Difference)"
        ];


    const confidenceGap =
        confidenceGapRaw !== undefined &&
        confidenceGapRaw !== null &&
        confidenceGapRaw !== ""
            ? parseFloat(
                String(confidenceGapRaw).replace("%", "")
            )
            : null;


    const confidenceGapDisplay =
        confidenceGap !== null
            ? `${confidenceGap.toFixed(2)}%`
            : "N/A";


    const riskLevel =
        row[
            "Risk Level (Final ScamSense Assessment)"
        ] || "N/A";


    const verification =
        row[
            "Cross-Verification (Model Agreement)"
        ] ||
        "No - Not required";


    const requiresVerification =
        row[
            "Cross-Verification (Model Agreement)"
        ]?.startsWith("Yes");


    // ==========================================
    // Risk colour
    // ==========================================

    const getRiskColor = (risk) => {

        switch ((risk || "").toLowerCase()) {

            case "high":
                return "error";

            case "medium":
                return "warning";

            case "low":
                return "success";

            default:
                return "default";

        }

    };


    // ==========================================
    // Confidence colour
    // ==========================================

    const getConfidenceColor = (level) => {

        switch ((level || "").toLowerCase()) {

            case "high":
                return "success";

            case "medium":
                return "warning";

            case "low":
                return "error";

            default:
                return "default";

        }

    };


    // ==========================================
    // Confidence reasoning
    // ==========================================

    const getConfidenceReason = () => {

        if (
            confidence === "N/A" ||
            confidenceLevel === "N/A"
        ) {

            return (
                "Confidence information is unavailable."
            );

        }


        if (
            confidenceLevel.toLowerCase() === "high"
        ) {

            if (confidenceGap !== null) {

                return (
                    <>
                        The ML model has{" "}
                        <strong>
                            high confidence ({confidence})
                        </strong>.
                        The prediction has a confidence score of{" "}
                        <strong>{confidence}</strong>, which meets the
                        minimum <strong>80.00% model confidence</strong>{" "}
                        required for a high-confidence classification.
                        The confidence gap of{" "}
                        <strong>
                            {confidenceGap.toFixed(2)}%
                        </strong>{" "}
                        also meets the minimum{" "}
                        <strong>
                            15.00% confidence-gap threshold
                        </strong>,
                        meaning the highest-scoring prediction is at least
                        15 percentage points ahead of the
                        second-highest prediction.
                    </>
                );

            }


            return (
                <>
                    The ML model has{" "}
                    <strong>
                        high confidence ({confidence})
                    </strong>.
                    The model confidence meets the minimum{" "}
                    <strong>
                        80.00% confidence threshold
                    </strong>
                    required for a high-confidence classification.
                </>
            );

        }


        if (
            confidenceLevel.toLowerCase() === "medium"
        ) {

            if (confidenceGap !== null) {

                return (
                    <>
                        The ML model has{" "}
                        <strong>
                            medium confidence ({confidence})
                        </strong>.
                        The model confidence does not fully satisfy
                        the criteria for a high-confidence prediction.
                        The confidence gap between the highest and
                        second-highest predictions is{" "}
                        <strong>
                            {confidenceGap.toFixed(2)}%
                        </strong>,
                        compared with the required{" "}
                        <strong>
                            15.00% confidence-gap threshold
                        </strong>
                        for high-confidence classification.
                    </>
                );

            }


            return (
                <>
                    The ML model has{" "}
                    <strong>
                        medium confidence ({confidence})
                    </strong>.
                    The prediction does not fully satisfy the
                    criteria for a high-confidence classification.
                </>
            );

        }


        if (
            confidenceLevel.toLowerCase() === "low"
        ) {

            return (
                <>
                    The ML model has{" "}
                    <strong>
                        low confidence ({confidence})
                    </strong>.
                    The model confidence is below the{" "}
                    <strong>
                        60.00% low-confidence threshold
                    </strong>,
                    so additional internal cross-verification is
                    required to increase confidence in the final
                    classification.
                </>
            );

        }


        return (
            <>
                The ML model produced a confidence score of{" "}
                <strong>{confidence}</strong>.
            </>
        );

    };


    // ==========================================
    // Verification reasoning
    // ==========================================

    const getVerificationReason = () => {

        if (requiresVerification) {

            return (
                verification ||
                "Additional internal cross-verification was performed because the ML prediction did not meet the required confidence criteria."
            );

        }


        return (
            verification ||
            "Additional internal cross-verification was not required because the ML prediction met the required confidence criteria."
        );

    };


    return (

        <Dialog

            open={open}

            onClose={onClose}

            maxWidth="lg"

            fullWidth

            PaperProps={{

                sx: {

                    borderRadius: 4,

                    maxHeight: "88vh",

                    mb: 8,

                    /*
                     * FORCE MUI DIALOG TO FOLLOW
                     * SCAMSENSE THEME
                     */

                    backgroundColor:
                        "var(--card) !important",

                    color:
                        "var(--card-foreground) !important",

                    border:
                        "1px solid var(--border)",

                    backgroundImage:
                        "none !important",

                    boxShadow:
                        "0 20px 60px rgba(0, 0, 0, 0.25)"

                }

            }}

        >

            {/* =====================================
                TITLE
            ====================================== */}

            <DialogTitle

                sx={{

                    fontWeight: "bold",

                    fontSize: 28,

                    color:
                        "var(--foreground) !important"

                }}

            >

                AI Analysis Report

            </DialogTitle>


            <DialogContent

                dividers

                sx={{

                    backgroundColor:
                        "var(--card) !important",

                    color:
                        "var(--foreground) !important",

                    borderColor:
                        "var(--border) !important"

                }}

            >

                {/* =====================================
                    ORIGINAL MESSAGE
                ====================================== */}

                <Box
                    sx={{
                        mb: 2
                    }}
                >

                    <Typography
                        variant="h6"
                        fontWeight="bold"
                        gutterBottom
                        sx={{
                            color:
                                "var(--foreground)"
                        }}
                    >

                        Original Message

                    </Typography>


                    <Typography

                        sx={{

                            mt: 2,

                            lineHeight: 1.8,

                            color:
                                "var(--foreground)"

                        }}

                    >

                        {row.Text}

                    </Typography>

                </Box>


                {/* =====================================
                    CLASSIFICATION INFORMATION
                ====================================== */}

                <Grid
                    container
                    spacing={4}
                    sx={{
                        mt: 4,
                        mb: 5
                    }}
                >

                    {/* Scam Type */}

                    <Grid size={{ xs: 12, md: 3 }}>

                        <Typography

                            sx={{
                                mb: 1,
                                color:
                                    "var(--muted-foreground)"
                            }}

                        >

                            Scam Type

                        </Typography>


                        <Chip
                            label={scamType}
                            color={
                                scamType === "Legitimate"
                                    ? "success"
                                    : "error"
                            }
                        />

                    </Grid>


                    {/* Confidence */}

                    <Grid size={{ xs: 12, md: 3 }}>

                        <Typography

                            sx={{
                                mb: 1,
                                color:
                                    "var(--muted-foreground)"
                            }}

                        >

                            Confidence

                        </Typography>


                        <Typography

                            fontWeight="bold"

                            sx={{
                                color:
                                    "var(--foreground)"
                            }}

                        >

                            {confidence}

                        </Typography>

                    </Grid>


                    {/* Confidence Level */}

                    <Grid size={{ xs: 12, md: 3 }}>

                        <Typography

                            sx={{
                                mb: 1,
                                color:
                                    "var(--muted-foreground)"
                            }}

                        >

                            Confidence Level

                        </Typography>


                        <Chip
                            label={confidenceLevel}
                            color={
                                getConfidenceColor(
                                    confidenceLevel
                                )
                            }
                        />

                    </Grid>


                    {/* Risk Level */}

                    <Grid size={{ xs: 12, md: 3 }}>

                        <Typography

                            sx={{
                                mb: 1,
                                color:
                                    "var(--muted-foreground)"
                            }}

                        >

                            Risk Level

                        </Typography>


                        <Chip
                            label={riskLevel}
                            color={
                                getRiskColor(
                                    riskLevel
                                )
                            }
                        />

                    </Grid>

                </Grid>


                {/* =====================================
                    INTERNAL CROSS-VERIFICATION
                ====================================== */}

                <Box

                    sx={{

                        mb: 4,

                        p: 2,

                        borderRadius: 2,

                        backgroundColor:
                            "var(--muted) !important",

                        border:
                            "1px solid var(--border)",

                        color:
                            "var(--foreground)"

                    }}

                >

                    <Typography

                        fontWeight={700}

                        sx={{

                            mb: 1,

                            color:
                                "var(--foreground)"

                        }}

                    >

                        Internal Cross-Verification

                    </Typography>


                    <Typography

                        variant="body2"

                        sx={{

                            color:
                                "var(--muted-foreground)"

                        }}

                    >

                        {verification}

                    </Typography>

                </Box>


                {/* =====================================
                    ASSESSMENT REASONING
                ====================================== */}

                <Box

                    sx={{

                        mb: 4,

                        p: 3,

                        borderRadius: 3,

                        backgroundColor:
                            "var(--muted) !important",

                        border:
                            "1px solid var(--border)",

                        color:
                            "var(--foreground)"

                    }}

                >

                    <Typography

                        variant="h6"

                        fontWeight={700}

                        sx={{

                            mb: 2,

                            color:
                                "var(--foreground)"

                        }}

                    >

                        Assessment Details

                    </Typography>


                    {/* Confidence Reasoning */}

                    <Box sx={{ mb: 2.5 }}>

                        <Typography

                            fontWeight={700}

                            sx={{

                                mb: 0.5,

                                color:
                                    "var(--foreground)"

                            }}

                        >

                            Confidence Assessment

                        </Typography>


                        <Typography

                            variant="body2"

                            sx={{

                                color:
                                    "var(--muted-foreground)",

                                lineHeight: 1.7

                            }}

                        >

                            {getConfidenceReason()}

                        </Typography>

                    </Box>


                    {/* Confidence Gap */}

                    {confidenceGap !== null && (

                        <Box sx={{ mb: 2.5 }}>

                            <Typography

                                fontWeight={700}

                                sx={{

                                    mb: 0.5,

                                    color:
                                        "var(--foreground)"

                                }}

                            >

                                Confidence Gap

                            </Typography>


                            <Typography

                                variant="body2"

                                sx={{

                                    color:
                                        "var(--muted-foreground)",

                                    lineHeight: 1.7

                                }}

                            >

                                The difference between the highest and
                                second-highest ML predictions was{" "}
                                <strong>
                                    {confidenceGapDisplay}
                                </strong>.
                                A minimum confidence gap of{" "}
                                <strong>15.00%</strong> is required for the
                                prediction to be classified as
                                <strong> high confidence</strong>.

                            </Typography>

                        </Box>

                    )}


                    {/* Verification Reasoning */}

                    <Box sx={{ mb: 2.5 }}>

                        <Typography

                            fontWeight={700}

                            sx={{

                                mb: 0.5,

                                color:
                                    "var(--foreground)"

                            }}

                        >

                            Internal Cross-Verification

                        </Typography>


                        <Typography

                            variant="body2"

                            sx={{

                                color:
                                    "var(--muted-foreground)",

                                lineHeight: 1.7

                            }}

                        >

                            {requiresVerification ? (

                                <>
                                    Additional internal cross-verification was{" "}
                                    <strong>required</strong> because the ML
                                    prediction did not satisfy the required
                                    confidence criteria. The prediction was
                                    therefore checked using additional models.
                                </>

                            ) : (

                                <>
                                    Additional internal cross-verification was{" "}
                                    <strong>not required</strong> because the ML
                                    prediction satisfied the high-confidence
                                    criteria of at least{" "}
                                    <strong>80.00% model confidence</strong> and
                                    a minimum{" "}
                                    <strong>15.00% confidence gap </strong>
                                    between the highest and second-highest
                                    predictions.
                                </>

                            )}

                        </Typography>

                    </Box>


                    {/* Risk Assessment */}

                    <Box>

                        <Typography

                            fontWeight={700}

                            sx={{

                                mb: 0.5,

                                color:
                                    "var(--foreground)"

                            }}

                        >

                            Risk Assessment

                        </Typography>


                        <Typography

                            variant="body2"

                            sx={{

                                color:
                                    "var(--muted-foreground)",

                                lineHeight: 1.7

                            }}

                        >

                            The final ScamSense risk level is{" "}
                            <strong>{riskLevel}</strong>.
                            This is the final risk classification assigned
                            after considering the model prediction,
                            confidence level, and ScamSense assessment
                            rules.

                        </Typography>

                    </Box>

                </Box>


                {/* =====================================
                    AI SUMMARY
                ====================================== */}

                <InfoCard

                    title="AI Summary"

                    content={
                        row["AI Summary"] ||
                        "No information available."
                    }

                />


                {/* =====================================
                    WHY SUSPICIOUS
                ====================================== */}

                <InfoCard

                    title={whyTitle}

                    content={
                        row[
                            "Why Suspicious / Legitimate Explanation"
                        ] ||
                        (
                            isLegitimate
                                ? "This message appears likely to be legitimate based on the ScamSense analysis."
                                : "No additional explanation was provided."
                        )
                    }

                />


                {/* =====================================
                    BULLET INFORMATION
                ====================================== */}

                <Grid

                    container

                    spacing={3}

                    sx={{
                        mt: 2
                    }}

                >

                    {/* Scam Indicators */}

                    <Grid
                        size={{
                            xs: 12,
                            md: 6
                        }}
                    >

                        <BulletCard

                            title="Scam Indicators"

                            items={formatBulletItems(
                                row["Scam Indicators"]
                            )}

                        />

                    </Grid>


                    {/* Safety Advice */}

                    <Grid
                        size={{
                            xs: 12,
                            md: 6
                        }}
                    >

                        <BulletCard

                            title="Safety Advice"

                            items={formatBulletItems(
                                row["Safety Advice"]
                            )}

                        />

                    </Grid>


                    {/* Recommended Actions */}

                    <Grid
                        size={{
                            xs: 12,
                            md: 6
                        }}
                    >

                        <BulletCard

                            title="Recommended Actions"

                            items={formatBulletItems(
                                row["Recommended Actions"]
                            )}

                        />

                    </Grid>


                    {/* Prevention Tips */}

                    <Grid
                        size={{
                            xs: 12,
                            md: 6
                        }}
                    >

                        <BulletCard

                            title="Prevention Tips"

                            items={formatBulletItems(
                                row["Prevention Tips"]
                            )}

                        />

                    </Grid>

                </Grid>

            </DialogContent>


            {/* =====================================
                CLOSE BUTTON
            ====================================== */}

            <DialogActions

                sx={{

                    backgroundColor:
                        "var(--card) !important",

                    borderTop:
                        "1px solid var(--border)"

                }}

            >

                <Button

                    variant="contained"

                    onClick={onClose}

                    sx={{

                        bgcolor:
                            "var(--primary)",

                        color:
                            "var(--primary-foreground)",

                        textTransform:
                            "none",

                        fontWeight: 600,

                        boxShadow:
                            "none",

                        "&:hover": {

                            bgcolor:
                                "var(--primary-hover)",

                            boxShadow:
                                "none"

                        }

                    }}

                >

                    Close

                </Button>

            </DialogActions>

        </Dialog>

    );

}


export default BatchAnalysisDialog;