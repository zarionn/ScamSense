import {
    TextField,
    Button
} from "@mui/material";

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
    loading,
    batchLoading,
    selectedFile,
    setSelectedFile,
    isSingleMessageMode,

}) {

    // ==========================================
    // VALIDATION
    // ==========================================

    const meaningfulText = message
        .replace(/[^a-zA-Z0-9]/g, "")
        .trim();


    let inputError = "";


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


    // ==========================================
    // HANDLE INPUT
    // ==========================================

    const handleMessageChange = (event) => {

        setMessage(event.target.value);

    };


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

                        error={Boolean(inputError)}

                        helperText={
                            inputError ||
                            "Enter a suspicious SMS, WhatsApp or Email message."
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
                        ACTION ROW
                    ========================================== */}

                    <div className="mt-3 flex items-center justify-between">

                        <div className="flex gap-2">

                            {/* Analyze */}

                            <Button

                                variant="contained"

                                startIcon={
                                    <SearchRoundedIcon />
                                }

                                onClick={onAnalyze}

                                disabled={
                                    loading ||
                                    batchLoading ||
                                    Boolean(inputError)
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


                            {/* Clear */}

                            <Button

                                variant="outlined"

                                startIcon={
                                    <RestartAltRoundedIcon />
                                }

                                onClick={onClear}

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


                        {/* Counter */}

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

                        isSingleMessageMode={isSingleMessageMode}

                        onAnalyzeDataset={onAnalyzeDataset}

                    />

                </div>

            </div>

        </div>

    );

}

export default MessageInputCard;