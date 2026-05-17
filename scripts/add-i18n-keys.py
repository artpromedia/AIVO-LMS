#!/usr/bin/env python3
"""Add new i18n keys for the V&I dashboard + learner interface to every locale file.

Non-English files receive the English value as a placeholder so callers never
hit a missing-key error. Translators replace the values per-locale later.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MSG = ROOT / "apps" / "web" / "src" / "i18n" / "messages"

NEW_KEYS = {
    "common": {
        "logout": "Log out",
        "settings": "Settings",
        "close": "Close",
        "loading_detail": "Loading detail…",
    },
    "learner": {
        "tab_today": "Today",
        "tab_adventures": "Adventures",
        "tab_rewards": "Rewards",
        "tab_play": "Play",
        "tab_gifts": "Gifts",
        "tab_content_label": "{tab} tab content",
        "mood_recorded": "Mood check-in recorded!",
        "greeting": "Hi, {userName}!",
        "nav_label": "Learner navigation",
        "missions_title": "Daily Missions",
        "xp_reward": "+{xp} XP",
        "quest_worlds_title": "Quest Worlds",
        "adventures_title_simple": "Adventures",
        "explore_quests": "Explore quests",
        "challenges": "Challenges",
        "homework_helper": "Homework Helper",
        "world_mathlands": "Mathlands",
        "world_word": "Word World",
        "world_science": "Science Frontier",
        "world_time": "Time Archive",
        "world_code": "Code Realm",
        "shop": "Shop",
        "rewards_badges": "Badges",
        "leaderboard": "Leaderboard",
        "recent_badges": "Recent Badges",
        "streak_days_label": "Streak: {count, plural, one {# day} other {# days}}",
        "streak_best_label": "Best: {count}",
        "emotion_happy": "Happy",
        "emotion_okay": "Okay",
        "emotion_sad": "Sad",
        "emotion_frustrated": "Frustrated",
        "emotion_tired": "Tired",
        "emotion_excited": "Excited",
        "feeling_prompt": "How are you feeling?",
        "minutes_count": "{count} minutes",
        "tutors_shelf_label": "Your tutors",
        "pick_a_friend": "Pick a friend",
        "your_tutors": "Your Tutors",
        "play_with_tutor": "Play with {name}",
        "take_a_break": "Take a break",
        "presymbolic_welcome": "Welcome, {userName}!",
        "parent_managed_learning": "Parent Managed Learning",
        "stars_count": "{count} Stars",
        "progress_label": "Your progress",
        "progress_streak_days": "{count, plural, one {# day} other {# days}}",
        "progress_n_day_streak": "{count}-day",
        "progress_badges_count": "{count, plural, one {# badge} other {# badges}}",
        "progress_mood": "mood: {mood}",
        "progress_level": "Lv. {level}",
        "approval_title": "Your Brain is Ready!",
        "approval_description": "Your learning brain has been built! A grown-up needs to review it before you can start learning.",
        "approval_waiting": "Waiting for parent approval",
        "approval_instruction": "Ask your parent to check their dashboard",
        "mission_nova_session": "Complete 1 session with Nova",
        "mission_sage_reading": "Practice reading with Sage",
    },
    "parent": {
        "brain_history_title": "Brain History",
        "brain_history_description": "Every change we've recorded to your child's learning profile",
        "brain_history_empty_title": "No history yet",
        "brain_history_empty_desc": "Brain snapshots appear here whenever the profile changes.",
        "brain_history_back": "← Back to learner",
        "brain_history_default_label": "Update",
        "brain_history_functioning_level": "Functioning level",
        "brain_history_grade_band": "Grade band",
        "brain_history_tracked_skills": "Tracked skills",
        "brain_history_skills_count": "{count, plural, one {# skill} other {# skills}}",
        "brain_history_accommodations": "Accommodations",
        "brain_trigger_parent_approval": "Parent approved baseline",
        "brain_trigger_parent_amend": "Parent amended profile",
        "brain_trigger_parent_decline": "Parent declined recommendation",
        "brain_trigger_rollback": "Rolled back to earlier version",
        "brain_trigger_regression_check": "Regression check",
        "brain_trigger_engagement_update": "Engagement profile updated",
        "brain_trigger_initial_clone": "Initial brain created",
    },
    "districtAdmin": {
        "integrations_subtitle": "Connect your district's learning tools to automatically sync rosters, classes, and student data.",
        "integrations_tab_available": "Available",
        "integrations_tab_connected": "Connected",
        "integrations_status_connected": "Connected",
        "integrations_status_coming_soon": "Coming Soon",
        "integrations_status_available": "Available",
        "integrations_button_view_connection": "View Connection",
        "integrations_button_notify": "Notify me when available",
        "integrations_button_connect": "Connect",
        "integrations_button_connecting": "Connecting...",
        "integrations_button_sync_now": "Sync Now",
        "integrations_button_syncing": "Syncing...",
        "integrations_button_disconnect": "Disconnect",
        "integrations_docs_title": "View documentation",
        "integrations_different_title": "Need a different integration?",
        "integrations_different_desc": "We're always adding new connectors. If your district uses a platform not listed here, let us know and we'll prioritize it.",
        "integrations_different_button": "Request Integration",
        "integrations_empty_title": "No integrations connected",
        "integrations_empty_desc": "Connect Google Classroom, Clever, or ClassLink to automatically sync your district's roster data.",
        "integrations_empty_button": "Browse Integrations",
        "integrations_connected_at": "Connected {when}",
        "integrations_last_sync": "Last sync: {when}",
        "integrations_toast_connected_success": "Integration connected successfully! You can now run your first sync.",
        "integrations_toast_connect_failed": "Connection failed: {error}",
        "integrations_toast_connector_connected": "{name} connected successfully!",
        "integrations_toast_connect_failed_generic": "Failed to connect",
        "integrations_toast_connect_failed_retry": "Connection failed. Please try again.",
        "integrations_toast_api_key_success": "Integration connected successfully!",
        "integrations_toast_sync_started": "Sync started! This may take a few minutes.",
        "integrations_toast_sync_failed": "Sync failed",
        "integrations_toast_sync_failed_start": "Failed to start sync",
        "integrations_toast_disconnect_confirm": "Are you sure you want to disconnect this integration? Synced data will be preserved.",
        "integrations_toast_disconnected": "Integration disconnected.",
        "integrations_toast_disconnect_failed": "Failed to disconnect",
        "integrations_time_never": "Never",
        "integrations_time_just_now": "Just now",
        "integrations_time_minutes_ago": "{m}m ago",
        "integrations_time_hours_ago": "{h}h ago",
        "integrations_time_days_ago": "{d}d ago",
        "integrations_label_last_sync_status": "Last Sync Status",
        "integrations_label_records_synced": "Records Synced",
        "integrations_label_failed": "Failed",
        "integrations_label_skipped": "Skipped",
        "integrations_label_duration": "Duration",
        "integrations_label_sync_history": "Sync History",
        "integrations_label_errors": "Errors",
        "integrations_sync_type_label": "{type} sync",
        "integrations_records_count": "{count} records",
        "integrations_request_submitted_title": "Request Submitted",
        "integrations_request_submitted_desc": "Thank you! We'll review your request and keep you updated on its status.",
        "integrations_request_done": "Done",
        "integrations_request_modal_title": "Request an Integration",
        "integrations_request_modal_desc": "Tell us which platform you'd like us to support and we'll prioritize it.",
        "integrations_request_platform_label": "Platform Name",
        "integrations_request_platform_placeholder": "e.g. Infinite Campus, Aeries, etc.",
        "integrations_cancel": "Cancel",
        "integrations_submit_request": "Submit Request",
        "integrations_request_toast_submitted": "Integration request for \"{name}\" submitted!",
        "integrations_apikey_modal_title": "Connect {name}",
        "integrations_canvas_url_label": "Canvas Instance URL",
        "integrations_canvas_url_placeholder": "https://yourschool.instructure.com",
        "integrations_api_token_label": "API Access Token",
        "integrations_api_token_placeholder": "Paste your API token here",
        "integrations_api_token_help": "Generate an access token from your admin settings. This is stored securely and encrypted.",
        "integrations_waitlist_title": "Get notified when {name} is ready",
        "integrations_waitlist_desc": "We'll email you the moment this integration is available for your district.",
        "integrations_waitlist_email_label": "Contact email",
        "integrations_waitlist_email_placeholder": "you@district.org",
        "integrations_waitlist_submitting": "Submitting...",
        "integrations_waitlist_notify_me": "Notify me",
        "integrations_waitlist_toast_joined": "You're on the waitlist. We'll be in touch.",
        "integrations_waitlist_toast_failed": "Failed to join waitlist",
    },
}


def deep_merge(target: dict, src: dict) -> None:
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(target.get(k), dict):
            deep_merge(target[k], v)
        elif k not in target:
            target[k] = v


def main() -> None:
    files = sorted(MSG.glob("*.json"))
    if not files:
        raise SystemExit(f"no locale files in {MSG}")
    for f in files:
        data = json.loads(f.read_text(encoding="utf-8"))
        deep_merge(data, NEW_KEYS)
        f.write_text(
            json.dumps(data, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(f"updated {f.name}")


if __name__ == "__main__":
    main()
