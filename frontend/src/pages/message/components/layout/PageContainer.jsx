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
                    borderRadius: "var(--radius-xl)",
                    backgroundColor: "var(--card)",
                    color: "var(--card-foreground)",
                    border: "1px solid var(--border)",
                    backgroundImage: "none"
                }
            }}
        >

            <DialogContent className="p-10 text-center">

                {/* ==========================================
                    TITLE
                ========================================== */}

                <h2 className="text-2xl font-bold text-primary">
                    ScamSense AI
                </h2>


                <p className="mb-8 mt-2 text-sm text-muted-foreground">
                    Please wait while ScamSense analyses your message.
                </p>


                {/* ==========================================
                    LOADING
                ========================================== */}

                <div className="mb-8 flex justify-center">

                    <CircularProgress
                        size={70}
                        thickness={4}
                        sx={{
                            color: "var(--primary)"
                        }}
                    />

                </div>


                {/* ==========================================
                    STEPS
                ========================================== */}

                <div className="mt-2 flex flex-col gap-4 text-left">

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

                                {/* Completed */}

                                {completed && (

                                    <CheckCircleRoundedIcon
                                        sx={{
                                            color: "#4CAF50",
                                            fontSize: 22
                                        }}
                                    />

                                )}


                                {/* Current */}

                                {current && (

                                    <AutorenewRoundedIcon
                                        sx={{
                                            color: "var(--primary)",
                                            fontSize: 22,

                                            animation:
                                                "scamsense-spin 1s linear infinite",

                                            "@keyframes scamsense-spin": {

                                                "0%": {
                                                    transform: "rotate(0deg)"
                                                },

                                                "100%": {
                                                    transform: "rotate(360deg)"
                                                }

                                            }
                                        }}
                                    />

                                )}


                                {/* Pending */}

                                {!completed && !current && (

                                    <RadioButtonUncheckedRoundedIcon
                                        sx={{
                                            color: "var(--muted-foreground)",
                                            opacity: 0.6,
                                            fontSize: 22
                                        }}
                                    />

                                )}


                                <span
                                    className={
                                        completed
                                            ? "text-sm font-medium text-foreground"
                                            : current
                                                ? "text-sm font-semibold text-primary"
                                                : "text-sm text-muted-foreground"
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