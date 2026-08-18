import {
    Dialog,
    DialogContent,
    CircularProgress
} from "@mui/material";

import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";

import { useEffect, useState } from "react";


const steps = [

    "Validating Input",
    "Running Machine Learning Model",
    "Generating Explainable AI",
    "Retrieving Scam Knowledge",
    "Generating AI Report",
    "Preparing Dashboard"

];


function ProcessingDialog({ open }) {

    const [currentStep, setCurrentStep] = useState(0);


    useEffect(() => {

        if (!open) {

            setCurrentStep(0);

            return;

        }


        const interval = setInterval(() => {

            setCurrentStep((previous) => {

                if (previous < steps.length - 1) {

                    return previous + 1;

                }

                return previous;

            });

        }, 1200);


        return () => clearInterval(interval);

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
                    backgroundColor: "#FFFFFF",

                    // Default text colour
                    color: "#111827",

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

                    <h2 className="text-2xl font-bold text-[#4F46E5]">
                        ScamSense AI
                    </h2>

                    <p className="mt-2 text-sm text-[#6B7280]">
                        Please wait while ScamSense analyses your message.
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
                    PROCESSING STEPS
                ========================================== */}

                <div className="mt-8 flex flex-col gap-4">

                    {steps.map((step, index) => {

                        const completed =
                            index < currentStep;

                        const current =
                            index === currentStep;


                        return (

                            <div
                                key={step}
                                className="flex items-center gap-3"
                            >

                                {/* ==========================================
                                    COMPLETED
                                ========================================== */}

                                {completed && (

                                    <CheckCircleRoundedIcon
                                        sx={{
                                            color: "#4CAF50",
                                            fontSize: 23
                                        }}
                                    />

                                )}


                                {/* ==========================================
                                    CURRENT
                                ========================================== */}

                                {current && (

                                    <AutorenewRoundedIcon
                                        sx={{

                                            color: "#6C3BFF",

                                            fontSize: 23,

                                            animation:
                                                "scamsense-spin 1s linear infinite",

                                            "@keyframes scamsense-spin": {

                                                "0%": {
                                                    transform:
                                                        "rotate(0deg)"
                                                },

                                                "100%": {
                                                    transform:
                                                        "rotate(360deg)"
                                                }

                                            }

                                        }}
                                    />

                                )}


                                {/* ==========================================
                                    PENDING
                                ========================================== */}

                                {!completed && !current && (

                                    <RadioButtonUncheckedRoundedIcon
                                        sx={{
                                            color: "#9CA3AF",
                                            fontSize: 23,
                                            opacity: 0.8
                                        }}
                                    />

                                )}


                                {/* ==========================================
                                    STEP TEXT
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

                                    {step}

                                </span>

                            </div>

                        );

                    })}

                </div>

            </DialogContent>

        </Dialog>

    );

}


export default ProcessingDialog;