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


        return () =>
            clearInterval(interval);

    }, [open]);


    return (

        <Dialog

            open={open}

            maxWidth="sm"

            fullWidth

            PaperProps={{

                className: `
                    bg-card
                    text-card-foreground
                    border
                    border-border
                `,

                sx: {

                    borderRadius: 3,

                    /*
                     * IMPORTANT:
                     * Force MUI Paper to use the same
                     * theme colours as the rest of
                     * ScamSense.
                     */

                    backgroundColor:
                        "var(--card) !important",

                    color:
                        "var(--card-foreground) !important",

                    borderColor:
                        "var(--border) !important",

                    backgroundImage:
                        "none !important",

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

                    py: 5,

                    /*
                     * Force the content itself to inherit
                     * the current ScamSense theme.
                     */

                    backgroundColor:
                        "var(--card) !important",

                    color:
                        "var(--card-foreground) !important"

                }}

            >

                {/* ==========================================
                    TITLE
                ========================================== */}

                <div className="text-center">

                    <h2
                        className="
                            text-2xl
                            font-bold
                            text-foreground
                        "
                    >

                        ScamSense AI

                    </h2>


                    <p
                        className="
                            mt-2
                            text-sm
                            text-muted-foreground
                        "
                    >

                        Please wait while ScamSense analyses
                        your message.

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

                            color:
                                "var(--primary)"

                        }}

                    />

                </div>


                {/* ==========================================
                    PROCESSING STEPS
                ========================================== */}

                <div className="mt-8 flex flex-col gap-4">

                    {steps.map(
                        (step, index) => {

                            const completed =
                                index < currentStep;

                            const current =
                                index === currentStep;


                            return (

                                <div
                                    key={step}

                                    className="
                                        flex
                                        items-center
                                        gap-3
                                    "
                                >

                                    {/* ==========================================
                                        COMPLETED
                                    ========================================== */}

                                    {completed && (

                                        <CheckCircleRoundedIcon

                                            sx={{

                                                color:
                                                    "#2E7D32",

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

                                                color:
                                                    "var(--primary)",

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

                                    {!completed &&
                                        !current && (

                                            <RadioButtonUncheckedRoundedIcon

                                                sx={{

                                                    color:
                                                        "var(--muted-foreground)",

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

                                                ? `
                                                    text-sm
                                                    font-medium
                                                    text-foreground
                                                `

                                                : current

                                                    ? `
                                                        text-sm
                                                        font-semibold
                                                        text-primary
                                                    `

                                                    : `
                                                        text-sm
                                                        text-muted-foreground
                                                    `

                                        }

                                    >

                                        {step}

                                    </span>

                                </div>

                            );

                        }

                    )}

                </div>


            </DialogContent>

        </Dialog>

    );

}


export default ProcessingDialog;