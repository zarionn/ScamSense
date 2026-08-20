import {
    TextField,
    Button,
    Alert
} from "@mui/material";

import {
    ImageSearchRounded
} from "@mui/icons-material";

import { useRef, useState } from "react";

import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";

import CharacterCounter from "./CharacterCounter";
import UploadDatasetCard from "./UploadDatasetCard";


const MIN_LENGTH = 10;
const MAX_LENGTH = 5000;


function MessageInputCard({
    message,
    setMessage,
    onAnalyze,
    onAnalyzeDataset,
    onClear,
    onOpenOCR,
    loading,
    batchLoading,
    selectedFile,
    setSelectedFile,
    isSingleMessageMode,
    hasMultipleMessages,
    detectedMessageCount,
}) {

    const imageInputRef = useRef(null);
    const [hasInteracted, setHasInteracted] = useState(false);


    // ==========================================
// VALIDATION
// ==========================================

const meaningfulText = message
    .replace(/[^a-zA-Z0-9]/g, "")
    .trim();


let inputError = "";


/*
    Do not show validation errors when the page
    first loads.

    Once the user has interacted with the input,
    validation will continue even when the input
    becomes empty again.
*/

if (hasInteracted) {

    if (message.length === 0) {

        inputError =
            "Please enter a message.";

    }

    else if (meaningfulText.length === 0) {

        inputError =
            "Message cannot contain only spaces or symbols. Please enter a message containing letters or numbers.";

    }

    else if (meaningfulText.length < MIN_LENGTH) {

        inputError =
            `Message must contain at least ${MIN_LENGTH} meaningful characters.`;

    }

    else if (message.length > MAX_LENGTH) {

        inputError =
            `Maximum ${MAX_LENGTH} characters allowed.`;

    }

}


    // ==========================================
    // HANDLE INPUT
    // ==========================================

   const handleMessageChange = (event) => {

    setHasInteracted(true);

    setMessage(event.target.value);

};

    // ==========================================
    // HANDLE OCR IMAGE
    // ==========================================

    const handleOCRImageSelected = (event) => {

        const file = event.target.files?.[0];

        if (!file) {
            return;
        }


        const allowedTypes = [
            "image/png",
            "image/jpeg",
            "image/jpg",
            "image/webp",
        ];


        if (!allowedTypes.includes(file.type)) {

            alert(
                "Please upload a PNG, JPG or WEBP image."
            );

            event.target.value = "";

            return;
        }


        const MAX_SIZE = 10 * 1024 * 1024;


        if (file.size > MAX_SIZE) {

            alert(
                "Image size must be less than 10 MB."
            );

            event.target.value = "";

            return;
        }


        onOpenOCR?.(file);

        event.target.value = "";

    };


    // ==========================================
    // DETERMINE IF INPUT IS EMPTY
    // ==========================================

    const isMessageEmpty =
        message.trim().length === 0;


    // ==========================================
    // RENDER
    // ==========================================

    return (

        <div
            className="
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

            <h2 className="mb-6 text-xl font-semibold text-foreground">

                1. Enter or Paste the Message or Upload Excel File

            </h2>


            <div className="grid gap-6 md:grid-cols-12">


                {/* ==========================================
                    LEFT SECTION
                ========================================== */}

                <div className="flex flex-col md:col-span-8">


                    {/* ==========================================
                        MESSAGE INPUT
                    ========================================== */}

                    <TextField

                        multiline

                        rows={11}

                        fullWidth

                        placeholder="Paste a suspicious SMS, WhatsApp or Email message here..."

                        value={message}

                        onChange={handleMessageChange}

                        disabled={
                            loading ||
                            batchLoading ||
                            selectedFile !== null
                        }

                        error={
                            Boolean(inputError)
                        }

                        helperText={

                            inputError

                                ? inputError

                                : "Enter a suspicious SMS, WhatsApp or Email message."

                        }

                        inputProps={{
                            maxLength: MAX_LENGTH
                        }}

                        sx={{

                            "& .MuiOutlinedInput-root": {

                                backgroundColor:
                                    "var(--background)",

                                color:
                                    "var(--foreground)",

                                borderRadius:
                                    "8px",

                                "& fieldset": {

                                    borderColor:
                                        inputError
                                            ? "var(--destructive)"
                                            : "var(--border)"

                                },

                                "&:hover fieldset": {

                                    borderColor:
                                        inputError
                                            ? "var(--destructive)"
                                            : "var(--primary)"

                                },

                                "&.Mui-focused fieldset": {

                                    borderColor:
                                        inputError
                                            ? "var(--destructive)"
                                            : "var(--primary)"

                                }

                            },

                            "& .MuiInputBase-input": {

                                color:
                                    "var(--foreground)"

                            },

                            "& .MuiInputBase-input::placeholder": {

                                color:
                                    "var(--muted-foreground)",

                                opacity: 1

                            },

                            "& .MuiFormHelperText-root": {

                                color:
                                    inputError
                                        ? "var(--destructive)"
                                        : "var(--muted-foreground)"

                            }

                        }}

                    />


                    {/* ==========================================
                        MULTIPLE MESSAGE WARNING
                    ========================================== */}

                    {hasMultipleMessages && (

                        <Alert
                            severity="warning"
                            sx={{
                                mt: 1.5,
                                borderRadius: 2,
                            }}
                        >

                            <strong>
                                Multiple messages detected.
                            </strong>{" "}

                            We detected {detectedMessageCount} messages
                            in your input.

                            Single Message Analysis accepts only one
                            message at a time.

                            To analyse multiple messages, use the{" "}

                            <strong>
                                Upload Excel Dataset
                            </strong>{" "}

                            option.

                            Create a{" "}

                            <strong>
                                Text
                            </strong>{" "}

                            column and enter each message in a
                            separate row.

                        </Alert>

                    )}


                    {/* ==========================================
                        HIDDEN OCR FILE INPUT
                    ========================================== */}

                    <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"

                        onChange={
                            handleOCRImageSelected
                        }

                        disabled={
                            loading ||
                            batchLoading ||
                            selectedFile !== null
                        }
                    />


                    {/* ==========================================
                        ACTION ROW
                    ========================================== */}

                    <div className="mt-3 flex items-center justify-between">


                        <div className="flex gap-2">


                            {/* ==========================================
                                ANALYZE MESSAGE
                            ========================================== */}

                            <Button

                                variant="contained"

                                startIcon={
                                    <SearchRoundedIcon />
                                }

                                onClick={onAnalyze}

                                disabled={

                                    loading ||

                                    batchLoading ||

                                    isMessageEmpty ||

                                    Boolean(inputError) ||

                                    hasMultipleMessages

                                }

                                sx={{

                                    bgcolor:
                                        "var(--primary)",

                                    color:
                                        "var(--primary-foreground)",

                                    px: 3,

                                    borderRadius: 2,

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

                                Analyze Message

                            </Button>


                            {/* ==========================================
                                EXTRACT TEXT FROM IMAGE
                            ========================================== */}

                            <Button

                                variant="outlined"

                                startIcon={
                                    <ImageSearchRounded />
                                }

                                onClick={() =>
                                    imageInputRef.current?.click()
                                }

                                disabled={

                                    loading ||

                                    batchLoading ||

                                    selectedFile !== null

                                }

                                sx={{

                                    color:
                                        "var(--primary)",

                                    borderColor:
                                        "var(--primary)",

                                    px: 3,

                                    borderRadius: 2,

                                    textTransform:
                                        "none",

                                    fontWeight: 600,

                                    "&:hover": {

                                        borderColor:
                                            "var(--primary-hover)",

                                        backgroundColor:
                                            "color-mix(in oklch, var(--primary) 8%, transparent)"

                                    }

                                }}

                            >

                                Extract Text

                            </Button>


                            {/* ==========================================
                                CLEAR
                            ========================================== */}

                            <Button

                                variant="outlined"

                                startIcon={
                                    <RestartAltRoundedIcon />
                                }

                                onClick={() => {

                                    setHasInteracted(false);

                                    onClear();

                                }}

                                disabled={
                                    loading ||
                                    batchLoading
                                }

                                sx={{

                                    color:
                                        "var(--primary)",

                                    borderColor:
                                        "var(--primary)",

                                    px: 3,

                                    borderRadius: 2,

                                    textTransform:
                                        "none",

                                    fontWeight: 600,

                                    "&:hover": {

                                        borderColor:
                                            "var(--primary-hover)",

                                        backgroundColor:
                                            "color-mix(in oklch, var(--primary) 8%, transparent)"

                                    }

                                }}

                            >

                                Clear

                            </Button>


                        </div>


                        {/* ==========================================
                            CHARACTER COUNTER
                        ========================================== */}

                        <CharacterCounter
                            current={message.length}
                            max={MAX_LENGTH}
                        />

                    </div>

                </div>


                {/* ==========================================
                    RIGHT SECTION
                ========================================== */}

                <div className="flex md:col-span-4">

                    <UploadDatasetCard

                        loading={loading}

                        batchLoading={batchLoading}

                        selectedFile={selectedFile}

                        setSelectedFile={setSelectedFile}

                        isSingleMessageMode={
                            isSingleMessageMode
                        }

                        onAnalyzeDataset={
                            onAnalyzeDataset
                        }

                    />

                </div>

            </div>

        </div>

    );

}


export default MessageInputCard;