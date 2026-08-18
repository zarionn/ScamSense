import { useState } from "react";

import {
    IconButton,
    Fab
} from "@mui/material";

import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

function FloatingAssistant() {

    const [open, setOpen] = useState(true);

    return (

        <>

            {/* ==========================================
                FLOATING CHAT BUTTON
            ========================================== */}

            <Fab
                color="primary"
                onClick={() => setOpen((previous) => !previous)}
                sx={{
                    position: "fixed",
                    bottom: 30,
                    right: 30,
                    zIndex: 9999,

                    bgcolor: "var(--primary)",
                    color: "var(--primary-foreground)",

                    "&:hover": {
                        bgcolor: "var(--primary-hover)"
                    }
                }}
            >
                <SmartToyRoundedIcon />
            </Fab>


            {/* ==========================================
                ASSISTANT CARD
            ========================================== */}

            {open && (

                <div
                    className="
                        fixed
                        bottom-[100px]
                        right-[30px]
                        z-[9998]
                        w-[340px]
                        rounded-xl
                        border
                        border-border
                        bg-card
                        p-6
                        text-card-foreground
                        shadow-xl
                    "
                >

                    {/* Header */}

                    <div className="mb-4 flex w-full items-start justify-between">

                        <h3 className="flex-1 text-lg font-bold text-foreground">
                            Think something is a scam?
                        </h3>

                        <IconButton
                            size="small"
                            onClick={() => setOpen(false)}
                            sx={{
                                ml: 1,
                                color: "var(--muted-foreground)"
                            }}
                        >
                            <CloseRoundedIcon />
                        </IconButton>

                    </div>


                    {/* Description */}

                    <p className="text-sm leading-7 text-muted-foreground">
                        ScamSense AI can help analyse suspicious
                        messages and provide safety recommendations.
                    </p>

                </div>

            )}

        </>
    );
}

export default FloatingAssistant;