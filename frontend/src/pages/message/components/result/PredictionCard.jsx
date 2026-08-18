import {
    Chip,
    LinearProgress
} from "@mui/material";

import GppBadRoundedIcon from "@mui/icons-material/GppBadRounded";
import GppGoodRoundedIcon from "@mui/icons-material/GppGoodRounded";
import AnalyticsRoundedIcon from "@mui/icons-material/AnalyticsRounded";
import AccountBalanceRoundedIcon from "@mui/icons-material/AccountBalanceRounded";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import WorkRoundedIcon from "@mui/icons-material/WorkRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import AttachMoneyRoundedIcon from "@mui/icons-material/AttachMoneyRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import ShoppingBagRoundedIcon from "@mui/icons-material/ShoppingBagRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";


function PredictionCard({ result }) {


    // ==========================================
    // CONFIDENCE
    // ==========================================

    const confidence = parseFloat(
        String(
            result?.confidence_score || "0"
        ).replace("%", "")
    ) || 0;


    // ==========================================
    // RISK COLOUR
    // ==========================================

    const getRiskColor = (risk) => {

        switch ((risk || "").toLowerCase()) {

            case "high":
                return "#E53935";

            case "medium":
                return "#FB8C00";

            case "low":
                return "#43A047";

            default:
                return "#9E9E9E";

        }

    };


    // ==========================================
    // SCAM ICON
    // ==========================================

    const getScamIcon = (type) => {

        switch (type) {

            case "Banking Scam":

                return (
                    <AccountBalanceRoundedIcon
                        sx={{ fontSize: 34 }}
                    />
                );


            case "Parcel Scam":

                return (
                    <LocalShippingRoundedIcon
                        sx={{ fontSize: 34 }}
                    />
                );


            case "Job Scam":

                return (
                    <WorkRoundedIcon
                        sx={{ fontSize: 34 }}
                    />
                );


            case "Romance Scam":

                return (
                    <FavoriteRoundedIcon
                        sx={{ fontSize: 34 }}
                    />
                );


            case "Investment Scam":

                return (
                    <AttachMoneyRoundedIcon
                        sx={{ fontSize: 34 }}
                    />
                );


            case "Lottery Scam":

                return (
                    <EmojiEventsRoundedIcon
                        sx={{ fontSize: 34 }}
                    />
                );


            case "E-commerce Scam":

                return (
                    <ShoppingBagRoundedIcon
                        sx={{ fontSize: 34 }}
                    />
                );


            case "Loan Scam":

                return (
                    <AccountBalanceWalletRoundedIcon
                        sx={{ fontSize: 34 }}
                    />
                );


            default:

                return (
                    <SecurityRoundedIcon
                        sx={{ fontSize: 34 }}
                    />
                );

        }

    };


    const isLegitimate =
        result?.predicted_scam_type === "Legitimate";


    return (

        <div
            className="
                mt-3
                rounded-xl
                border
                border-border
                bg-card
                p-5
                text-card-foreground
            "
        >

            {/* ==========================================
                TITLE
            ========================================== */}

            <h2 className="mb-5 text-xl font-bold text-foreground">
                ScamSense AI Analysis Result
            </h2>


            <div className="grid gap-4 md:grid-cols-12">


                {/* ==========================================
                    LEFT RISK CARD
                ========================================== */}

                <div className="md:col-span-4">

                    <div
                        className={`
                            flex
                            h-full
                            min-h-[300px]
                            flex-col
                            items-center
                            justify-center
                            rounded-xl
                            border
                            p-6
                            text-center

                            ${
                                isLegitimate
                                    ? "border-green-500/30 bg-green-500/[0.04]"
                                    : "border-red-500/30 bg-red-500/[0.04]"
                            }
                        `}
                    >

                        {/* ==========================================
                            RISK ICON
                        ========================================== */}

                        {isLegitimate ? (

                            <GppGoodRoundedIcon
                                sx={{
                                    color:
                                        getRiskColor(
                                            result?.risk_level
                                        ),
                                    fontSize: 58
                                }}
                            />

                        ) : (

                            <GppBadRoundedIcon
                                sx={{
                                    color:
                                        getRiskColor(
                                            result?.risk_level
                                        ),
                                    fontSize: 58
                                }}
                            />

                        )}


                        {/* ==========================================
                            RISK
                        ========================================== */}

                        <h3 className="mt-4 text-2xl font-bold text-foreground">
                            {result?.risk_level} Risk
                        </h3>


                        {/* ==========================================
                            DESCRIPTION
                        ========================================== */}

                        <p className="mt-2 max-w-[240px] text-sm leading-7 text-muted-foreground">

                            {isLegitimate

                                ? "This message appears likely to be legitimate."

                                : "This message has been identified as a potential scam."

                            }

                        </p>


                        {/* ==========================================
                            SCAM TYPE CHIP
                        ========================================== */}

                        <Chip

                            label={
                                result?.predicted_scam_type
                            }

                            sx={{

                                mt: 3,

                                px: 1,

                                height: 36,

                                borderRadius:
                                    "18px",

                                bgcolor:
                                    getRiskColor(
                                        result?.risk_level
                                    ),

                                color:
                                    "#fff",

                                fontWeight:
                                    700,

                                fontSize:
                                    "0.95rem"

                            }}

                        />

                    </div>

                </div>


                {/* ==========================================
                    RIGHT SIDE
                ========================================== */}

                <div
                    className="
                        md:col-span-8
                        h-full
                    "
                >

                    <div
                        className="
                            grid
                            h-full
                            gap-4
                            grid-rows-[auto_1fr]
                        "
                    >


                        {/* ==========================================
                            CONFIDENCE
                        ========================================== */}

                        <div
                            className="
                                rounded-xl
                                border
                                border-border
                                bg-card
                                p-6
                            "
                        >

                            <div className="mb-4 flex items-center gap-2">

                                <AnalyticsRoundedIcon
                                    sx={{
                                        color:
                                            "var(--primary)"
                                    }}
                                />

                                <h3 className="font-bold text-foreground">
                                    Confidence Score
                                </h3>

                            </div>


                            <LinearProgress

                                variant="determinate"

                                value={confidence}

                                sx={{

                                    mt: 2,

                                    mb: 2,

                                    height: 10,

                                    borderRadius: 10,

                                    backgroundColor:
                                        "color-mix(in oklch, var(--primary) 12%, transparent)",

                                    "& .MuiLinearProgress-bar": {

                                        backgroundColor:
                                            "var(--primary)",

                                        borderRadius:
                                            10

                                    }

                                }}

                            />


                            <p className="text-right font-bold text-foreground">
                                {result?.confidence_score}
                            </p>

                        </div>


                        {/* ==========================================
                            SCAM TYPE
                        ========================================== */}

                        <div
                            className="
                                h-full
                                rounded-xl
                                border
                                border-border
                                bg-card
                                p-6
                                flex
                                items-center
                            "
                        >

                            <div
                                className="
                                    flex
                                    flex-wrap
                                    items-center
                                    gap-3
                                "
                            >

                                <span className="text-lg font-bold text-foreground">
                                    Scam Type:
                                </span>


                                <div className="flex items-center text-foreground">

                                    {getScamIcon(
                                        result?.predicted_scam_type
                                    )}

                                </div>


                                <Chip

                                    label={
                                        result?.predicted_scam_type
                                    }

                                    sx={{

                                        height: 36,

                                        px: 1,

                                        borderRadius:
                                            "18px",

                                        bgcolor:
                                            getRiskColor(
                                                result?.risk_level
                                            ),

                                        color:
                                            "#fff",

                                        fontWeight:
                                            700,

                                        fontSize:
                                            "0.95rem"

                                    }}

                                />

                            </div>

                        </div>

                    </div>

                </div>

            </div>

        </div>

    );

}


export default PredictionCard;