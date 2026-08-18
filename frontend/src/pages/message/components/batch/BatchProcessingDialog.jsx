import { useEffect, useState } from "react";

import {
    Dialog,
    DialogContent,
    CircularProgress
} from "@mui/material";

import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";


function BatchProcessingDialog({ open }) {

    const stages = [

        "Uploading Dataset",
        "Validating Dataset",
        "Analysing Messages",
        "Generating AI Report",
        "Preparing Download"

    ];


    const [currentStage, setCurrentStage] =
        useState(0);


    useEffect(() => {

        if (!open) {

            setCurrentStage(0);

            return;

        }


        const interval = setInterval(() => {

            setCurrentStage((previous) => {

                if (
                    previous >=
                    stages.length - 1
                ) {

                    return previous;

                }

                return previous + 1;

            });

        }, 2500);


        return () =>
            clearInterval(interval);

    }, [open]);


    return (

        <Dialog
            open={open}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {

                    borderRadius: 3,

                    // White dialog
                    backgroundColor:
                        "#FFFFFF",

                    // Default text colour
                    color:
                        "#111827",

                    border:
                        "1px solid #E5E7EB",

                    backgroundImage:
                        "none",

                    boxShadow:
                        "0 20px 60px rgba(0, 0, 0, 0.25)"

                }
            }}
        >

            <DialogContent
                sx={{
                    px: {
                        xs: 3,
                        sm: 5
                    },
                    py: 5
                }}
            >

                {/* ==========================================
                    TITLE
                ========================================== */}

                <div className="text-center">

                    <h2 className="text-2xl font-bold text-[#111827]">
                        ScamSense
                    </h2>

                    <p className="mt-2 text-lg font-semibold text-[#6C3BFF]">
                        Batch Dataset Analysis
                    </p>

                </div>


                {/* ==========================================
                    LOADING
                ========================================== */}

                <div className="mt-8 flex justify-center">

                    <CircularProgress
                        size={70}
                        thickness={4}
                        sx={{
                            color: "#6C3BFF"
                        }}
                    />

                </div>


                {/* ==========================================
                    DESCRIPTION
                ========================================== */}

                <p className="mt-6 text-center text-sm leading-6 text-[#6B7280]">

                    Please wait while ScamSense analyses
                    your uploaded dataset.

                </p>


                {/* ==========================================
                    STAGES
                ========================================== */}

                <div className="mt-8 flex flex-col items-start gap-4">

                    {stages.map(
                        (stage, index) => {

                            const completed =
                                index < currentStage;

                            const current =
                                index === currentStage;


                            return (

                                <div
                                    key={stage}
                                    className="flex items-center gap-3"
                                >

                                    {/* ==========================================
                                        COMPLETED
                                    ========================================== */}

                                    {completed && (

                                        <CheckCircleRoundedIcon
                                            sx={{
                                                color:
                                                    "#4CAF50",
                                                fontSize: 23
                                            }}
                                        />

                                    )}


                                    {/* ==========================================
                                        CURRENT
                                    ========================================== */}

                                    {current && (

                                        <MoreHorizRoundedIcon
                                            sx={{
                                                color:
                                                    "#6C3BFF",
                                                fontSize: 23
                                            }}
                                        />

                                    )}


                                    {/* ==========================================
                                        PENDING
                                    ========================================== */}

                                    {!completed &&
                                        !current && (

                                            <RadioButtonUncheckedRoundedIcon
                                                sx={{
                                                    color:
                                                        "#9CA3AF",
                                                    fontSize: 23,
                                                    opacity: 0.8
                                                }}
                                            />

                                        )}


                                    {/* ==========================================
                                        STAGE TEXT
                                    ========================================== */}

                                    <span
                                        className={

                                            completed

                                                ? "text-sm font-medium text-[#111827]"

                                                : current

                                                    ? "text-sm font-semibold text-[#6C3BFF]"

                                                    : "text-sm text-[#6B7280]"

                                        }
                                    >

                                        {stage}

                                    </span>

                                </div>

                            );

                        }
                    )}

                </div>


                {/* ==========================================
                    BOTTOM NOTE
                ========================================== */}

                <p className="mt-8 text-center text-xs leading-5 text-[#6B7280]">

                    This may take a few moments depending on
                    the number of uploaded messages.

                </p>

            </DialogContent>

        </Dialog>

    );

}


export default BatchProcessingDialog;