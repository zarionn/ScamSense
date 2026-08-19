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

                className: `
                    bg-card
                    text-card-foreground
                    border
                    border-border
                `,

                sx: {

                    borderRadius: 3,

                    /*
                     * FORCE MUI PAPER TO FOLLOW
                     * SCAMSENSE THEME VARIABLES
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
                     * FORCE CONTENT TO USE
                     * CURRENT THEME
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

                        ScamSense

                    </h2>


                    <p
                        className="
                            mt-2
                            text-lg
                            font-semibold
                            text-primary
                        "
                    >

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

                            color:
                                "var(--primary)"

                        }}

                    />

                </div>


                {/* ==========================================
                    DESCRIPTION
                ========================================== */}

                <p
                    className="
                        mt-6
                        text-center
                        text-sm
                        leading-6
                        text-muted-foreground
                    "
                >

                    Please wait while ScamSense analyses
                    your uploaded dataset.

                </p>


                {/* ==========================================
                    STAGES
                ========================================== */}

                <div
                    className="
                        mt-8
                        flex
                        flex-col
                        items-start
                        gap-4
                    "
                >

                    {stages.map(
                        (stage, index) => {

                            const completed =
                                index < currentStage;

                            const current =
                                index === currentStage;


                            return (

                                <div
                                    key={stage}

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

                                        <MoreHorizRoundedIcon

                                            sx={{

                                                color:
                                                    "var(--primary)",

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
                                                        "var(--muted-foreground)",

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

                <p
                    className="
                        mt-8
                        text-center
                        text-xs
                        leading-5
                        text-muted-foreground
                    "
                >

                    This may take a few moments depending on
                    the number of uploaded messages.

                </p>


            </DialogContent>

        </Dialog>

    );

}


export default BatchProcessingDialog;