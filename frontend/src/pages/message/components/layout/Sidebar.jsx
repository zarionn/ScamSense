import {
    Box,
    Typography,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Divider,
    Paper
} from "@mui/material";

import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import SmsRoundedIcon from "@mui/icons-material/SmsRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import PhoneRoundedIcon from "@mui/icons-material/PhoneRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesome";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";

function Sidebar() {

    const menuItems = [

        {
            text: "Dashboard",
            icon: <DashboardRoundedIcon />
        },

        {
            text: "Message Scam Detector",
            icon: <SmsRoundedIcon />,
            active: true
        },

        {
            text: "URL Phishing Detector",
            icon: <LinkRoundedIcon />
        },

        {
            text: "Scam Call Detector",
            icon: <PhoneRoundedIcon />
        },

        {
            text: "Scam Screenshot Detector",
            icon: <ImageRoundedIcon />
        },

        {
            text: "AI Image Analysis",
            icon: <AutoAwesomeRoundedIcon />
        }

    ];

    const bottomItems = [

        {
            text: "Safety Tips",
            icon: <SecurityRoundedIcon />
        },

        {
            text: "About ScamSense",
            icon: <InfoRoundedIcon />
        },

        {
            text: "Settings",
            icon: <SettingsRoundedIcon />
        }

    ];

    return (

        <Box
    sx={{
        width: 270,
        minWidth: 270,
        flexShrink: 0,

        display: "flex",
        flexDirection: "column",

        borderRight: "1px solid #E5E7EB",
        bgcolor: "#fff",

        position: "sticky",
        top: 0,

        height: "100vh"
    }}
>

            {/* ===========================
                Logo
            ============================ */}

            <Box
                sx={{
                    p: 3,
                    pb: 2
                }}
            >

                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mb: 1
                    }}
                >

                    <ShieldRoundedIcon
                        sx={{
                            color: "#6C3BFF",
                            fontSize: 34
                        }}
                    />

                    <Typography
                        variant="h5"
                        fontWeight="bold"
                    >

                        ScamSense

                    </Typography>

                </Box>

            </Box>

            <Divider />

            {/* ===========================
                Scrollable Menu
            ============================ */}

            <Box
                sx={{
                    flexGrow: 1,
                    overflowY: "auto",
                    px: 2,
                    py: 2
                }}
            >

                <List>

                    {menuItems.map((item) => (

                        <ListItemButton

                            key={item.text}

                            sx={{

                                mb: 1,

                                borderRadius: 3,

                                py: 1.2,

                                backgroundColor:

                                    item.active

                                        ? "#F3EEFF"

                                        : "transparent",

                                "&:hover": {

                                    backgroundColor: "#F7F5FF"

                                }

                            }}

                        >

                            <ListItemIcon

                                sx={{

                                    color:

                                        item.active

                                            ? "#6C3BFF"

                                            : "#64748B",

                                    minWidth: 42

                                }}

                            >

                                {item.icon}

                            </ListItemIcon>

                            <ListItemText

                                primary={item.text}

                            />

                        </ListItemButton>

                    ))}

                </List>

            </Box>

            <Divider />

            {/* ===========================
                Bottom Menu
            ============================ */}

            <Box
                sx={{
                    px: 2,
                    py: 2
                }}
            >

                <List>

                    {bottomItems.map((item) => (

                        <ListItemButton

                            key={item.text}

                            sx={{

                                mb: 0.8,

                                borderRadius: 3

                            }}

                        >

                            <ListItemIcon
                                sx={{
                                    minWidth: 42
                                }}
                            >

                                {item.icon}

                            </ListItemIcon>

                            <ListItemText

                                primary={item.text}

                            />

                        </ListItemButton>

                    ))}

                </List>


            </Box>

        </Box>

    );

}

export default Sidebar;