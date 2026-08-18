import {
    Stack,
    Button
} from "@mui/material";

import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";


function ActionButtons({
    onAnalyze,
    onClear
}) {

    return (

        <Stack
            direction="row"
            spacing={2}
            mt={3}
        >

            {/* Analyze */}

            <Button
                variant="contained"
                startIcon={<SearchRoundedIcon />}
                onClick={onAnalyze}
                sx={{
                    bgcolor: "var(--primary)",
                    color: "var(--primary-foreground)",
                    px: 3,
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 600,
                    boxShadow: "none",

                    "&:hover": {
                        bgcolor: "var(--primary-hover)",
                        boxShadow: "none"
                    },

                    "&:disabled": {
                        opacity: 0.5
                    }
                }}
            >
                Analyze Message
            </Button>


            {/* Clear */}

            <Button
                variant="outlined"
                startIcon={<RestartAltRoundedIcon />}
                onClick={onClear}
                sx={{
                    color: "var(--primary)",
                    borderColor: "var(--primary)",
                    px: 3,
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 600,

                    "&:hover": {
                        borderColor: "var(--primary-hover)",
                        backgroundColor:
                            "color-mix(in oklch, var(--primary) 8%, transparent)"
                    }
                }}
            >
                Clear
            </Button>

        </Stack>

    );

}

export default ActionButtons;