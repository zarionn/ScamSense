"""Recovery-action catalogue and selection for Screenshot GenAI."""

from typing import Dict, List

from .contracts import RecoveryAction


ACTION_CATALOGUE = {
    "shared_otp": [
        RecoveryAction(text="Contact the real organisation using a number you find yourself, not one from the message, and tell them the code was shared.", urgency="now", theme="contact_real_org"),
        RecoveryAction(text="If it was a bank or Singpass code, call your bank's 24/7 anti-scam hotline or the ScamShield Helpline at 1799 immediately.", urgency="now", theme="bank_hotline"),
        RecoveryAction(text="Change the password of the account the code was for, and turn on two-factor authentication if it is not already on.", urgency="soon", theme="change_password"),
    ],
    "made_payment": [
        RecoveryAction(text="Call your bank's 24/7 anti-scam hotline now to report the transfer and ask if it can be stopped or reversed.", urgency="now", theme="bank_hotline"),
        RecoveryAction(text="Freeze or lock the card or account used, through your banking app or by phone.", urgency="now", theme="freeze_card"),
        RecoveryAction(text="Report the scam at ScamShield (report.scamshield.gov.sg) or call 1799, and keep the transaction reference.", urgency="soon", theme="report_scamshield"),
    ],
    "gave_remote_access": [
        RecoveryAction(text="Disconnect the device from the internet now to cut off the remote session.", urgency="now", theme="disconnect_device"),
        RecoveryAction(text="Uninstall any app they asked you to install (such as AnyDesk or TeamViewer), then run a security scan.", urgency="now", theme="scan_device"),
        RecoveryAction(text="From a different, trusted device, change the passwords of any accounts you opened while they had access, starting with banking.", urgency="soon", theme="change_password"),
    ],
    "entered_credentials": [
        RecoveryAction(text="Change that account's password now from a device you trust, and change it anywhere else you reused the same password.", urgency="now", theme="change_password"),
        RecoveryAction(text="Turn on two-factor authentication for the account.", urgency="soon", theme="enable_2fa"),
        RecoveryAction(text="Check the account's recent login or security activity for sessions you do not recognise, and sign them out.", urgency="soon", theme="check_logins"),
    ],
    "shared_personal_info": [
        RecoveryAction(text="Be alert for follow-up scams that use your details to sound convincing; treat any urgent contact that references them with suspicion.", urgency="advisable", theme="watch_followup"),
        RecoveryAction(text="If you shared your NRIC or Singpass details, report it to ScamShield (1799) and monitor your Singpass activity.", urgency="soon", theme="report_scamshield"),
    ],
    "opened_attachment": [
        RecoveryAction(text="Do not enter any details into anything the file opened.", urgency="now", theme="do_not_enter"),
        RecoveryAction(text="Run a security scan on your device, and change key passwords from a different trusted device if you are unsure what it did.", urgency="soon", theme="scan_device"),
    ],
    "clicked_link": [
        RecoveryAction(text="Do not enter any information on the page that opened, and close it.", urgency="now", theme="do_not_enter"),
        RecoveryAction(text="Open the organisation's official app or type its official website address manually to check whether the message was genuine.", urgency="soon", theme="official_verification"),
    ],
    "general_contact": [
        RecoveryAction(text="Do not reply further, click anything, or send money or details.", urgency="now", theme="do_not_engage"),
        RecoveryAction(text="Verify independently through the organisation's official channel, and report the message to ScamShield (1799) if it is a scam.", urgency="advisable", theme="report_scamshield"),
    ],
}

URGENCY_ORDER = {"now": 0, "soon": 1, "advisable": 2}


def actions_for_dimensions(dimensions: List[str]) -> Dict:
    """Select mandatory actions only for the user's confirmed or uncertain exposures.

    De-duplicates by exact text and by action theme, keeping the most urgent
    action for a repeated theme.
    """
    invalid_dimensions = [
        dimension
        for dimension in dimensions
        if dimension not in ACTION_CATALOGUE
    ]

    if invalid_dimensions:
        raise ValueError(
            f"Unknown exposure dimensions: {invalid_dimensions}"
        )

    best_by_theme = {}
    seen_text = set()
    untagged = []

    for dimension in dimensions:
        for action in ACTION_CATALOGUE.get(dimension, []):
            if action.text in seen_text:
                continue

            seen_text.add(action.text)

            if action.theme is None:
                untagged.append(action)
                continue

            current = best_by_theme.get(action.theme)

            if (
                current is None
                or URGENCY_ORDER[action.urgency]
                < URGENCY_ORDER[current.urgency]
            ):
                best_by_theme[action.theme] = action

    actions = list(best_by_theme.values()) + untagged
    actions.sort(key=lambda action: URGENCY_ORDER[action.urgency])

    return {
        "dimensions": dimensions,
        "required_actions": actions,
    }
