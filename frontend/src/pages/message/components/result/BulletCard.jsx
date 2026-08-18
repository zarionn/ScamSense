import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";


function BulletCard({

    title,

    items = []

}) {


    // ==========================================
    // THEME
    // ==========================================

    const getTheme = () => {

        switch (title) {

            case "Scam Indicators":

                return {

                    icon:
                        <WarningAmberRoundedIcon />,

                    iconColor:
                        "#E53935",

                    header:
                        "bg-red-500/10",

                    item:
                        "bg-red-500/[0.03]"

                };


            case "Safety Advice":

                return {

                    icon:
                        <VerifiedUserRoundedIcon />,

                    iconColor:
                        "#2E7D32",

                    header:
                        "bg-green-500/10",

                    item:
                        "bg-green-500/[0.03]"

                };


            case "Recommended Actions":

                return {

                    icon:
                        <ChecklistRoundedIcon />,

                    iconColor:
                        "#1565C0",

                    header:
                        "bg-blue-500/10",

                    item:
                        "bg-blue-500/[0.03]"

                };


            default:

                return {

                    icon:
                        <SecurityRoundedIcon />,

                    iconColor:
                        "var(--primary)",

                    header:
                        "bg-primary/10",

                    item:
                        "bg-primary/[0.03]"

                };

        }

    };


    const theme =
        getTheme();


    // ==========================================
    // SUPPORT ARRAYS + STRINGS
    // ==========================================

    const bulletItems =

        Array.isArray(items)

            ? items

            : typeof items === "string"

                ? items
                    .split(/\r?\n|;/)
                    .map(
                        (item) =>
                            item.trim()
                    )
                    .filter(
                        (item) =>
                            item.length > 0
                    )

                : [];


    return (

        <div
            className="
                h-full
                overflow-hidden
                rounded-xl
                border
                border-border
                bg-card
                text-card-foreground
            "
        >

            {/* ==========================================
                HEADER
            ========================================== */}

            <div
                className={`
                    flex
                    items-center
                    gap-3
                    border-b
                    border-border
                    px-6
                    py-4
                    ${theme.header}
                `}
            >

                <div
                    style={{
                        color: theme.iconColor
                    }}
                    className="flex"
                >
                    {theme.icon}
                </div>

                <h3 className="text-lg font-bold text-foreground">
                    {title}
                </h3>

            </div>


            {/* ==========================================
                CONTENT
            ========================================== */}

            <div className="p-4">

                {bulletItems.length > 0 ? (

                    bulletItems.map(
                        (item, index) => (

                            <div
                                key={index}
                                className={`
                                    mb-3
                                    rounded-lg
                                    border
                                    border-border
                                    p-4
                                    last:mb-0
                                    ${theme.item}
                                `}
                            >

                                <div className="flex items-start gap-3">

                                    <div
                                        className="mt-0.5 shrink-0"
                                        style={{
                                            color:
                                                theme.iconColor
                                        }}
                                    >
                                        {theme.icon}
                                    </div>

                                    <p className="text-sm leading-7 text-foreground">
                                        {item}
                                    </p>

                                </div>

                            </div>

                        )

                    )

                ) : (

                    <p className="py-2 text-center text-sm text-muted-foreground">
                        No information available.
                    </p>

                )}

            </div>

        </div>

    );

}

export default BulletCard;