# =========================================================
# SYNCO REWARDS SYSTEM
# =========================================================

from datetime import datetime, timedelta
import hashlib

from flask import Blueprint, jsonify, session

from models import (
    db,
    User,
    UserProfile,
    ProfileGame,
    ProfileClip,
    Friendship,
    ClubMember,
    RewardChallenge,
    UserChallenge,
    RewardItem,
    UserInventory,
    Achievement,
    UserAchievement,
    RewardTransaction,
)


# =========================================================
# BLUEPRINT
# =========================================================

rewards_bp = Blueprint(
    "rewards",
    __name__,
    url_prefix="/api/rewards",
)


# =========================================================
# AUTH HELPERS
# =========================================================

def get_current_user():
    session_user = session.get("user")

    if not session_user:
        return None

    user_id = session_user.get("id")

    if not user_id:
        return None

    return db.session.get(
        User,
        user_id,
    )


def auth_required_response():
    return jsonify({
        "success": False,
        "message": "Authentication required.",
    }), 401


# =========================================================
# TIME HELPERS
# =========================================================

def utc_now():
    return datetime.utcnow()


def today_key():
    return utc_now().date().isoformat()


# =========================================================
# REWARD TRANSACTION REFERENCE HELPER
# =========================================================
#
# IMPORTANT:
#
# RewardTransaction.reference_id is an INTEGER column
# in the current SYNCO database.
#
# Older reward code was passing values such as:
#
#     "2026-09-15"
#     "PROFILE_COMPLETED"
#     "FIRST_GAME"
#     "1-175792..."
#
# PostgreSQL rejects those values.
#
# This helper converts every reference into an integer.
#
# Numeric references remain unchanged.
# String references are converted to a deterministic
# positive integer using SHA-256.
#
# The same string always produces the same integer,
# so duplicate protection continues to work.
# =========================================================

def normalize_reference_id(
    reference_type,
    reference_id,
):
    if reference_id is None:
        return None

    # Already integer
    if isinstance(reference_id, int):
        return reference_id

    # Numeric string
    try:
        text_value = str(reference_id).strip()

        if text_value.lstrip("-").isdigit():
            return int(text_value)

    except Exception:
        pass

    # Deterministic integer for non-numeric references
    raw_value = (
        f"{reference_type or ''}:"
        f"{reference_id}"
    )

    digest = hashlib.sha256(
        raw_value.encode("utf-8")
    ).digest()

    # Keep safely inside PostgreSQL INTEGER range
    value = int.from_bytes(
        digest[:8],
        byteorder="big",
        signed=False,
    )

    value = (
        value % 2147483646
    ) + 1

    return value


# =========================================================
# LEVEL SYSTEM
# =========================================================

def xp_required_for_level(level):
    return max(
        1,
        int(level or 1),
    ) * 100


def update_level(user):

    if user.level is None or user.level < 1:
        user.level = 1

    if user.xp is None:
        user.xp = 0

    while user.xp >= xp_required_for_level(
        user.level
    ):

        required = xp_required_for_level(
            user.level
        )

        user.xp -= required
        user.level += 1


# =========================================================
# TRANSACTION HELPERS
# =========================================================

def transaction_exists(
    user_id,
    reference_type,
    reference_id,
):
    if (
        reference_type is None
        or reference_id is None
    ):
        return False

    normalized_id = normalize_reference_id(
        reference_type,
        reference_id,
    )

    existing = (
        RewardTransaction.query
        .filter_by(
            user_id=user_id,
            reference_type=str(
                reference_type
            ),
            reference_id=normalized_id,
        )
        .first()
    )

    return existing is not None


def create_transaction(
    user_id,
    transaction_type,
    xp_amount=0,
    credits_amount=0,
    description=None,
    reference_type=None,
    reference_id=None,
):
    normalized_id = normalize_reference_id(
        reference_type,
        reference_id,
    )

    transaction = RewardTransaction(
        user_id=user_id,
        transaction_type=transaction_type,
        xp_amount=int(
            xp_amount or 0
        ),
        credits_amount=int(
            credits_amount or 0
        ),
        description=description,
        reference_type=(
            str(reference_type)
            if reference_type is not None
            else None
        ),
        reference_id=normalized_id,
    )

    db.session.add(transaction)

    return transaction


# =========================================================
# ADD XP
# =========================================================

def add_xp(
    user,
    amount,
    description=None,
    reference_type=None,
    reference_id=None,
    check_duplicate=True,
):
    amount = int(amount or 0)

    if amount <= 0:
        return False

    if (
        check_duplicate
        and transaction_exists(
            user.id,
            reference_type,
            reference_id,
        )
    ):
        return False

    user.xp = (
        user.xp or 0
    ) + amount

    create_transaction(
        user_id=user.id,
        transaction_type="XP_EARNED",
        xp_amount=amount,
        credits_amount=0,
        description=description,
        reference_type=reference_type,
        reference_id=reference_id,
    )

    update_level(user)

    return True


# =========================================================
# ADD CREDITS
# =========================================================

def add_credits(
    user,
    amount,
    description=None,
    reference_type=None,
    reference_id=None,
    check_duplicate=True,
):
    amount = int(amount or 0)

    if amount <= 0:
        return False

    if (
        check_duplicate
        and transaction_exists(
            user.id,
            reference_type,
            reference_id,
        )
    ):
        return False

    user.credits = (
        user.credits or 0
    ) + amount

    create_transaction(
        user_id=user.id,
        transaction_type="CREDITS_EARNED",
        xp_amount=0,
        credits_amount=amount,
        description=description,
        reference_type=reference_type,
        reference_id=reference_id,
    )

    return True


# =========================================================
# AWARD XP + CREDITS
# =========================================================

def award_rewards(
    user,
    xp=0,
    credits=0,
    description=None,
    reference_type=None,
    reference_id=None,
):
    if user is None:
        return False

    xp = int(xp or 0)
    credits = int(credits or 0)

    if xp <= 0 and credits <= 0:
        return False

    if (
        reference_type is not None
        and reference_id is not None
        and transaction_exists(
            user.id,
            reference_type,
            reference_id,
        )
    ):
        return False

    if xp > 0:

        user.xp = (
            user.xp or 0
        ) + xp

        create_transaction(
            user_id=user.id,
            transaction_type="XP_EARNED",
            xp_amount=xp,
            credits_amount=0,
            description=description,
            reference_type=reference_type,
            reference_id=reference_id,
        )

    if credits > 0:

        user.credits = (
            user.credits or 0
        ) + credits

        create_transaction(
            user_id=user.id,
            transaction_type="CREDITS_EARNED",
            xp_amount=0,
            credits_amount=credits,
            description=description,
            reference_type=reference_type,
            reference_id=reference_id,
        )

    update_level(user)

    return True


# =========================================================
# SPEND CREDITS
# =========================================================

def spend_credits(
    user,
    amount,
    description=None,
    reference_type=None,
    reference_id=None,
):
    amount = int(amount or 0)

    if amount <= 0:
        return False

    current_balance = (
        user.credits or 0
    )

    if current_balance < amount:
        return False

    user.credits = (
        current_balance - amount
    )

    create_transaction(
        user_id=user.id,
        transaction_type="CREDITS_SPENT",
        xp_amount=0,
        credits_amount=-amount,
        description=description,
        reference_type=reference_type,
        reference_id=reference_id,
    )

    return True


# =========================================================
# STREAK SYSTEM
# =========================================================

def update_streak(user):

    now = utc_now()

    if user.last_activity_at is None:

        user.current_streak = 1

        user.longest_streak = max(
            user.longest_streak or 0,
            1,
        )

        user.last_activity_at = now

        return True

    last_date = (
        user.last_activity_at.date()
    )

    current_date = now.date()

    if last_date == current_date:
        return False

    difference = (
        current_date - last_date
    ).days

    if difference == 1:

        user.current_streak = (
            user.current_streak or 0
        ) + 1

    else:

        user.current_streak = 1

    user.longest_streak = max(
        user.longest_streak or 0,
        user.current_streak,
    )

    user.last_activity_at = now

    return True


# =========================================================
# DAILY LOGIN REWARDS
# =========================================================

DAILY_LOGIN_REWARDS = {

    1: {
        "xp": 5,
        "credits": 2,
    },

    2: {
        "xp": 5,
        "credits": 3,
    },

    3: {
        "xp": 10,
        "credits": 5,
    },

    4: {
        "xp": 10,
        "credits": 5,
    },

    5: {
        "xp": 15,
        "credits": 8,
    },

    6: {
        "xp": 20,
        "credits": 10,
    },

    7: {
        "xp": 50,
        "credits": 25,
    },

}


def sync_daily_login_challenge(user):

    now = utc_now()

    daily_challenges = (
        RewardChallenge.query
        .filter(
            RewardChallenge.active.is_(True),
            RewardChallenge.challenge_type
            == "DAILY_LOGIN",
            RewardChallenge.period
            == "DAILY",
            RewardChallenge.starts_at <= now,
            db.or_(
                RewardChallenge.expires_at.is_(None),
                RewardChallenge.expires_at > now,
            ),
        )
        .all()
    )

    for challenge in daily_challenges:

        user_challenge = (
            UserChallenge.query
            .filter_by(
                user_id=user.id,
                challenge_id=challenge.id,
            )
            .first()
        )

        if user_challenge is None:

            user_challenge = UserChallenge(
                user_id=user.id,
                challenge_id=challenge.id,
                progress=0,
                completed=False,
                claimed=False,
                started_at=now,
            )

            db.session.add(
                user_challenge
            )

        user_challenge.progress = (
            challenge.target
        )

        user_challenge.completed = True

        if user_challenge.completed_at is None:
            user_challenge.completed_at = now

        user_challenge.claimed = True

        if user_challenge.claimed_at is None:
            user_challenge.claimed_at = now


def process_daily_login(user):

    if user is None:
        return False

    # =====================================================
    # INTEGER-SAFE DAILY REFERENCE
    # =====================================================

    reference_id = normalize_reference_id(
        "DAILY_LOGIN",
        today_key(),
    )

    # =====================================================
    # DUPLICATE PROTECTION
    # =====================================================

    if transaction_exists(
        user.id,
        "DAILY_LOGIN",
        reference_id,
    ):

        sync_daily_login_challenge(user)

        db.session.commit()

        return False

    # =====================================================
    # UPDATE STREAK
    # =====================================================

    changed = update_streak(user)

    if not changed:

        sync_daily_login_challenge(user)

        db.session.commit()

        return False

    # =====================================================
    # REWARD DAY
    # =====================================================

    streak_day = min(
        max(
            user.current_streak or 1,
            1,
        ),
        7,
    )

    reward = DAILY_LOGIN_REWARDS[
        streak_day
    ]

    # =====================================================
    # AWARD
    # =====================================================

    awarded = award_rewards(
        user=user,
        xp=reward["xp"],
        credits=reward["credits"],
        description=(
            f"Daily login reward - Day {streak_day}"
        ),
        reference_type="DAILY_LOGIN",
        reference_id=reference_id,
    )

    # =====================================================
    # CHALLENGE
    # =====================================================

    sync_daily_login_challenge(user)

    # =====================================================
    # ACHIEVEMENTS
    # =====================================================

    if awarded:
        check_all_achievements(user)

    db.session.commit()

    return awarded


# =========================================================
# PROFILE COMPLETION
# =========================================================

def is_profile_complete(user):

    profile = (
        UserProfile.query
        .filter_by(
            user_id=user.id
        )
        .first()
    )

    if profile is None:
        return False

    basic = profile.basic_data or {}

    name = str(
        basic.get("name")
        or user.name
        or ""
    ).strip()

    username = str(
        basic.get("username")
        or user.username
        or ""
    ).strip()

    region = str(
        basic.get("region")
        or ""
    ).strip()

    bio = str(
        basic.get("bio")
        or ""
    ).strip()

    avatar = str(
        basic.get("avatarUrl")
        or user.avatar
        or ""
    ).strip()

    return bool(
        name
        and username
        and region
        and bio
        and avatar
    )


# =========================================================
# SYNCO EVENT REWARDS
# =========================================================

SYNCO_EVENT_REWARDS = {

    "PROFILE_COMPLETED": {
        "xp": 25,
        "credits": 10,
        "description": "Profile completed",
        "reference_type": "MISSION",
        "reference_id": "PROFILE_COMPLETED",
        "challenge_type": "PROFILE_COMPLETED",
    },

    "GAME_ADDED": {
        "xp": 30,
        "credits": 15,
        "description": "First game added",
        "reference_type": "MISSION",
        "reference_id": "FIRST_GAME",
        "challenge_type": "GAME_ADDED",
    },

    "FIRST_GAME": {
        "xp": 30,
        "credits": 15,
        "description": "First game added",
        "reference_type": "MISSION",
        "reference_id": "FIRST_GAME",
        "challenge_type": "GAME_ADDED",
    },

    "FRIENDSHIP_CREATED": {
        "xp": 20,
        "credits": 10,
        "description": "First SYNCO connection",
        "reference_type": "MISSION",
        "reference_id": "FIRST_FRIENDSHIP",
        "challenge_type": "FRIENDSHIP_CREATED",
    },

    "FIRST_FRIENDSHIP": {
        "xp": 20,
        "credits": 10,
        "description": "First SYNCO connection",
        "reference_type": "MISSION",
        "reference_id": "FIRST_FRIENDSHIP",
        "challenge_type": "FRIENDSHIP_CREATED",
    },

    "CLUB_JOINED": {
        "xp": 30,
        "credits": 15,
        "description": "Joined your first club",
        "reference_type": "MISSION",
        "reference_id": "FIRST_CLUB",
        "challenge_type": "CLUB_JOINED",
    },

    "FIRST_CLUB": {
        "xp": 30,
        "credits": 15,
        "description": "Joined your first club",
        "reference_type": "MISSION",
        "reference_id": "FIRST_CLUB",
        "challenge_type": "CLUB_JOINED",
    },

    "CLIP_UPLOADED": {
        "xp": 30,
        "credits": 15,
        "description": "First gameplay clip uploaded",
        "reference_type": "MISSION",
        "reference_id": "FIRST_CLIP",
        "challenge_type": "CLIP_UPLOADED",
    },

    "FIRST_CLIP": {
        "xp": 30,
        "credits": 15,
        "description": "First gameplay clip uploaded",
        "reference_type": "MISSION",
        "reference_id": "FIRST_CLIP",
        "challenge_type": "CLIP_UPLOADED",
    },

}


# =========================================================
# SYNCO EVENT VALIDATION
# =========================================================

def validate_synco_event(
    user,
    event,
    reference_id=None,
    metadata=None,
):

    metadata = metadata or {}

    if event == "PROFILE_COMPLETED":
        return is_profile_complete(user)

    if event in (
        "GAME_ADDED",
        "FIRST_GAME",
    ):

        return (
            ProfileGame.query
            .filter_by(
                user_id=user.id
            )
            .count()
            >= 1
        )

    if event in (
        "CLIP_UPLOADED",
        "FIRST_CLIP",
    ):

        return (
            ProfileClip.query
            .filter_by(
                user_id=user.id
            )
            .count()
            >= 1
        )

    if event in (
        "FRIENDSHIP_CREATED",
        "FIRST_FRIENDSHIP",
    ):

        return (
            Friendship.query
            .filter_by(
                user_id=user.id
            )
            .count()
            >= 1
        )

    if event in (
        "CLUB_JOINED",
        "FIRST_CLUB",
    ):

        return (
            ClubMember.query
            .filter_by(
                user_id=user.id
            )
            .count()
            >= 1
        )

    return False


# =========================================================
# SYNCO EVENT GATEWAY
# =========================================================

def process_synco_event(
    user,
    event,
    reference_id=None,
    metadata=None,
):

    if user is None:
        return False

    event = str(
        event or ""
    ).strip().upper()

    metadata = metadata or {}

    if event not in SYNCO_EVENT_REWARDS:
        return False

    reward = SYNCO_EVENT_REWARDS[
        event
    ]

    # =====================================================
    # VERIFY REAL DATABASE EVENT
    # =====================================================

    if not validate_synco_event(
        user=user,
        event=event,
        reference_id=reference_id,
        metadata=metadata,
    ):
        return False

    # =====================================================
    # UPDATE MISSION
    # =====================================================

    challenge_type = reward.get(
        "challenge_type"
    )

    if challenge_type:

        update_challenge_progress(
            user=user,
            challenge_type=challenge_type,
            amount=1,
        )

    # =====================================================
    # AWARD
    # =====================================================

    awarded = award_rewards(
        user=user,
        xp=reward["xp"],
        credits=reward["credits"],
        description=reward["description"],
        reference_type=reward["reference_type"],
        reference_id=reward["reference_id"],
    )

    if not awarded:

        db.session.commit()

        return False

    # =====================================================
    # ACHIEVEMENTS
    # =====================================================

    check_all_achievements(user)

    db.session.commit()

    return True


# =========================================================
# CHALLENGE SERIALIZATION
# =========================================================

def serialize_challenge(
    challenge,
    user_challenge=None,
):

    progress = 0
    completed = False
    claimed = False

    if user_challenge:

        progress = (
            user_challenge.progress or 0
        )

        completed = bool(
            user_challenge.completed
        )

        claimed = bool(
            user_challenge.claimed
        )

    return {

        "id": challenge.id,

        "title": challenge.title,

        "description": challenge.description,

        "challengeType": (
            challenge.challenge_type
        ),

        "target": challenge.target,

        "progress": progress,

        "completed": completed,

        "claimed": claimed,

        "rewardXp": (
            challenge.reward_xp
        ),

        "rewardCredits": (
            challenge.reward_credits
        ),

        "xpReward": (
            challenge.reward_xp
        ),

        "creditReward": (
            challenge.reward_credits
        ),

        "period": challenge.period,

        "icon": challenge.icon,

        "active": challenge.active,

        "startsAt": (
            challenge.starts_at.isoformat()
            if challenge.starts_at
            else None
        ),

        "expiresAt": (
            challenge.expires_at.isoformat()
            if challenge.expires_at
            else None
        ),

    }


# =========================================================
# STORE SERIALIZATION
# =========================================================

def serialize_store_item(
    item,
    inventory_quantity=0,
):

    return {

        "id": item.id,

        "title": item.title,

        "name": item.title,

        "description": item.description,

        "price": item.price,

        "cost": item.price,

        "itemType": item.item_type,

        "type": item.item_type,

        "icon": item.icon,

        "active": item.active,

        "stock": item.stock,

        "owned": (
            inventory_quantity > 0
        ),

        "quantity": inventory_quantity,

    }


def serialize_inventory(
    inventory,
):

    item = inventory.reward_item

    return {

        "id": inventory.id,

        "rewardItemId": (
            inventory.reward_item_id
        ),

        "itemId": (
            inventory.reward_item_id
        ),

        "title": (
            item.title
            if item
            else None
        ),

        "name": (
            item.title
            if item
            else None
        ),

        "description": (
            item.description
            if item
            else None
        ),

        "itemType": (
            item.item_type
            if item
            else None
        ),

        "type": (
            item.item_type
            if item
            else None
        ),

        "icon": (
            item.icon
            if item
            else None
        ),

        "quantity": (
            inventory.quantity
        ),

        "acquiredAt": (
            inventory.acquired_at.isoformat()
            if inventory.acquired_at
            else None
        ),

    }


# =========================================================
# ACHIEVEMENT PROGRESS
# =========================================================

def get_achievement_progress(
    user,
    achievement,
):

    requirement = (
        achievement.requirement_type
        or ""
    ).upper()

    if requirement == "PROFILE_COMPLETED":

        return (
            1
            if is_profile_complete(user)
            else 0
        )

    if requirement == "GAMES":

        return (
            ProfileGame.query
            .filter_by(
                user_id=user.id
            )
            .count()
        )

    if requirement == "CLIPS":

        return (
            ProfileClip.query
            .filter_by(
                user_id=user.id
            )
            .count()
        )

    if requirement == "FRIENDSHIPS":

        return (
            Friendship.query
            .filter_by(
                user_id=user.id
            )
            .count()
        )

    if requirement == "CLUBS":

        return (
            ClubMember.query
            .filter_by(
                user_id=user.id
            )
            .count()
        )

    if requirement == "MATCHES_PLAYED":

        return (
            RewardTransaction.query
            .filter(
                RewardTransaction.user_id
                == user.id,
                RewardTransaction.reference_type
                == "MATCH",
                RewardTransaction.transaction_type
                == "XP_EARNED",
                RewardTransaction.xp_amount
                > 0,
            )
            .count()
        )

    if requirement == "MATCH_WINS":

        return (
            RewardTransaction.query
            .filter(
                RewardTransaction.user_id
                == user.id,
                RewardTransaction.reference_type
                == "MATCH_WIN",
                RewardTransaction.transaction_type
                == "XP_EARNED",
                RewardTransaction.xp_amount
                > 0,
            )
            .count()
        )

    if requirement == "TOURNAMENTS_PLAYED":

        return (
            RewardTransaction.query
            .filter(
                RewardTransaction.user_id
                == user.id,
                RewardTransaction.reference_type
                == "TOURNAMENT",
                RewardTransaction.transaction_type
                == "XP_EARNED",
                RewardTransaction.xp_amount
                > 0,
            )
            .count()
        )

    if requirement == "TOURNAMENT_WINS":

        return (
            RewardTransaction.query
            .filter(
                RewardTransaction.user_id
                == user.id,
                RewardTransaction.reference_type
                == "TOURNAMENT_WIN",
                RewardTransaction.transaction_type
                == "XP_EARNED",
                RewardTransaction.xp_amount
                > 0,
            )
            .count()
        )

    if requirement == "STREAK":

        return (
            user.current_streak or 0
        )

    if requirement == "LEVEL":

        return (
            user.level or 1
        )

    if requirement == "XP":

        return (
            user.xp or 0
        )

    if requirement == "CREDITS":

        return (
            user.credits or 0
        )

    return 0


# =========================================================
# ACHIEVEMENT SERIALIZATION
# =========================================================

def serialize_achievement(
    user,
    achievement,
):

    unlocked_record = (
        UserAchievement.query
        .filter_by(
            user_id=user.id,
            achievement_id=achievement.id,
        )
        .first()
    )

    unlocked = (
        unlocked_record is not None
    )

    progress = get_achievement_progress(
        user,
        achievement,
    )

    requirement_value = (
        achievement.requirement_value
        or 1
    )

    return {

        "id": achievement.id,

        "title": achievement.title,

        "name": achievement.title,

        "description": achievement.description,

        "requirementType": (
            achievement.requirement_type
        ),

        "requirementValue": (
            requirement_value
        ),

        "progress": min(
            progress,
            requirement_value,
        ),

        "unlocked": unlocked,

        "rewardXp": (
            achievement.reward_xp
        ),

        "rewardCredits": (
            achievement.reward_credits
        ),

        "icon": achievement.icon,

        "active": achievement.active,

        "unlockedAt": (
            unlocked_record.unlocked_at.isoformat()
            if (
                unlocked_record
                and unlocked_record.unlocked_at
            )
            else None
        ),

    }


# =========================================================
# TRANSACTION SERIALIZATION
# =========================================================

def serialize_transaction(
    transaction,
):

    if transaction.xp_amount:
        amount = transaction.xp_amount

    else:
        amount = (
            transaction.credits_amount
            or 0
        )

    return {

        "id": transaction.id,

        "transactionType": (
            transaction.transaction_type
        ),

        "xpAmount": (
            transaction.xp_amount or 0
        ),

        "creditsAmount": (
            transaction.credits_amount or 0
        ),

        "amount": amount,

        "description": (
            transaction.description
        ),

        "referenceType": (
            transaction.reference_type
        ),

        "referenceId": (
            transaction.reference_id
        ),

        "createdAt": (
            transaction.created_at.isoformat()
            if transaction.created_at
            else None
        ),

    }


# =========================================================
# SEED CHALLENGES
# =========================================================

def seed_reward_challenges():

    now = utc_now()

    # =====================================================
    # DISABLE LEGACY CHALLENGES
    # =====================================================

    legacy_types = {
        "MATCH",
        "MATCH_WIN",
        "TOURNAMENT",
        "TOURNAMENT_WIN",
        "WEEKLY_DAILY",
    }

    legacy_challenges = (
        RewardChallenge.query
        .filter(
            RewardChallenge.challenge_type.in_(
                legacy_types
            )
        )
        .all()
    )

    for challenge in legacy_challenges:
        challenge.active = False

    # =====================================================
    # ONE-TIME MISSIONS
    # =====================================================

    once_challenges = [

        {
            "title": "Complete Your Profile",
            "description": (
                "Complete your SYNCO profile."
            ),
            "challenge_type": "PROFILE_COMPLETED",
            "target": 1,
            "reward_xp": 25,
            "reward_credits": 10,
            "period": "ONCE",
            "icon": "user",
        },

        {
            "title": "Add Your First Game",
            "description": (
                "Add your first game to your SYNCO profile."
            ),
            "challenge_type": "GAME_ADDED",
            "target": 1,
            "reward_xp": 30,
            "reward_credits": 15,
            "period": "ONCE",
            "icon": "gamepad",
        },

        {
            "title": "Make Your First Connection",
            "description": (
                "Become friends with another SYNCO player."
            ),
            "challenge_type": "FRIENDSHIP_CREATED",
            "target": 1,
            "reward_xp": 20,
            "reward_credits": 10,
            "period": "ONCE",
            "icon": "users",
        },

        {
            "title": "Join Your First Club",
            "description": (
                "Join your first SYNCO club."
            ),
            "challenge_type": "CLUB_JOINED",
            "target": 1,
            "reward_xp": 30,
            "reward_credits": 15,
            "period": "ONCE",
            "icon": "shield",
        },

        {
            "title": "Upload Your First Clip",
            "description": (
                "Upload your first gameplay clip."
            ),
            "challenge_type": "CLIP_UPLOADED",
            "target": 1,
            "reward_xp": 30,
            "reward_credits": 15,
            "period": "ONCE",
            "icon": "video",
        },

    ]

    for data in once_challenges:

        existing = (
            RewardChallenge.query
            .filter_by(
                challenge_type=data[
                    "challenge_type"
                ],
                period="ONCE",
            )
            .first()
        )

        if existing is None:

            db.session.add(
                RewardChallenge(
                    title=data["title"],
                    description=data[
                        "description"
                    ],
                    challenge_type=data[
                        "challenge_type"
                    ],
                    target=data["target"],
                    reward_xp=data[
                        "reward_xp"
                    ],
                    reward_credits=data[
                        "reward_credits"
                    ],
                    period=data["period"],
                    icon=data["icon"],
                    active=True,
                    starts_at=now,
                    expires_at=None,
                )
            )

        else:

            existing.title = (
                data["title"]
            )

            existing.description = (
                data["description"]
            )

            existing.target = (
                data["target"]
            )

            existing.reward_xp = (
                data["reward_xp"]
            )

            existing.reward_credits = (
                data["reward_credits"]
            )

            existing.icon = (
                data["icon"]
            )

            existing.active = True

            existing.starts_at = (
                existing.starts_at
                or now
            )

            existing.expires_at = None

    # =====================================================
    # DAILY LOGIN
    # =====================================================

    active_daily_login = (
        RewardChallenge.query
        .filter(
            RewardChallenge.period
            == "DAILY",

            RewardChallenge.challenge_type
            == "DAILY_LOGIN",

            RewardChallenge.active.is_(True),

            RewardChallenge.starts_at <= now,

            db.or_(
                RewardChallenge.expires_at.is_(None),
                RewardChallenge.expires_at > now,
            ),
        )
        .first()
    )

    if active_daily_login is None:

        db.session.add(
            RewardChallenge(
                title="Daily Check-In",
                description=(
                    "Log in to SYNCO today and maintain your streak."
                ),
                challenge_type="DAILY_LOGIN",
                target=1,
                reward_xp=0,
                reward_credits=0,
                period="DAILY",
                icon="calendar",
                active=True,
                starts_at=now,
                expires_at=(
                    now + timedelta(days=1)
                ),
            )
        )

    db.session.commit()


# =========================================================
# SEED STORE
# =========================================================

def seed_reward_store():

    if RewardItem.query.count() > 0:
        return

    items = [

        {
            "title": "Profile Frame",
            "description": (
                "Unlock a premium profile frame."
            ),
            "price": 500,
            "item_type": "PROFILE_FRAME",
            "icon": "frame",
            "stock": -1,
        },

        {
            "title": "XP Boost",
            "description": (
                "A reward item for your inventory."
            ),
            "price": 750,
            "item_type": "XP_BOOST",
            "icon": "zap",
            "stock": -1,
        },

        {
            "title": "Exclusive Badge",
            "description": (
                "Show off an exclusive SYNCO badge."
            ),
            "price": 1000,
            "item_type": "BADGE",
            "icon": "badge",
            "stock": -1,
        },

        {
            "title": "Premium Title",
            "description": (
                "Unlock a premium player title."
            ),
            "price": 1500,
            "item_type": "TITLE",
            "icon": "crown",
            "stock": -1,
        },

    ]

    for data in items:

        db.session.add(
            RewardItem(
                title=data["title"],
                description=data[
                    "description"
                ],
                price=data["price"],
                item_type=data[
                    "item_type"
                ],
                icon=data["icon"],
                active=True,
                stock=data["stock"],
            )
        )

    db.session.commit()


# =========================================================
# SEED ACHIEVEMENTS
# =========================================================

def seed_achievements():

    existing_titles = {
        row.title
        for row in Achievement.query.all()
    }

    achievements = [

        {
            "title": "Profile Ready",
            "description": (
                "Complete your SYNCO profile."
            ),
            "requirement_type": (
                "PROFILE_COMPLETED"
            ),
            "requirement_value": 1,
            "reward_xp": 50,
            "reward_credits": 20,
            "icon": "user-check",
        },

        {
            "title": "Gamer Identity",
            "description": (
                "Add your first game."
            ),
            "requirement_type": "GAMES",
            "requirement_value": 1,
            "reward_xp": 75,
            "reward_credits": 25,
            "icon": "gamepad",
        },

        {
            "title": "First Connection",
            "description": (
                "Make your first SYNCO connection."
            ),
            "requirement_type": (
                "FRIENDSHIPS"
            ),
            "requirement_value": 1,
            "reward_xp": 75,
            "reward_credits": 25,
            "icon": "users",
        },

        {
            "title": "Club Member",
            "description": (
                "Join your first club."
            ),
            "requirement_type": "CLUBS",
            "requirement_value": 1,
            "reward_xp": 75,
            "reward_credits": 25,
            "icon": "shield",
        },

        {
            "title": "Clip Creator",
            "description": (
                "Upload your first gameplay clip."
            ),
            "requirement_type": "CLIPS",
            "requirement_value": 1,
            "reward_xp": 75,
            "reward_credits": 25,
            "icon": "video",
        },

        {
            "title": "7 Day Streak",
            "description": (
                "Maintain a 7 day SYNCO activity streak."
            ),
            "requirement_type": "STREAK",
            "requirement_value": 7,
            "reward_xp": 500,
            "reward_credits": 100,
            "icon": "flame",
        },

    ]

    for data in achievements:

        if data["title"] in existing_titles:
            continue

        db.session.add(
            Achievement(
                title=data["title"],
                description=data[
                    "description"
                ],
                requirement_type=data[
                    "requirement_type"
                ],
                requirement_value=data[
                    "requirement_value"
                ],
                reward_xp=data[
                    "reward_xp"
                ],
                reward_credits=data[
                    "reward_credits"
                ],
                icon=data["icon"],
                active=True,
            )
        )

    db.session.commit()


# =========================================================
# INITIALIZE USER CHALLENGES
# =========================================================

def initialize_user_challenges(user):

    now = utc_now()

    challenges = (
        RewardChallenge.query
        .filter(
            RewardChallenge.active.is_(True),
            RewardChallenge.starts_at <= now,
            db.or_(
                RewardChallenge.expires_at.is_(None),
                RewardChallenge.expires_at > now,
            ),
        )
        .all()
    )

    for challenge in challenges:

        existing = (
            UserChallenge.query
            .filter_by(
                user_id=user.id,
                challenge_id=challenge.id,
            )
            .first()
        )

        if existing is None:

            db.session.add(
                UserChallenge(
                    user_id=user.id,
                    challenge_id=challenge.id,
                    progress=0,
                    completed=False,
                    claimed=False,
                    started_at=now,
                )
            )

    db.session.commit()


# =========================================================
# UPDATE CHALLENGE PROGRESS
# =========================================================

def update_challenge_progress(
    user,
    challenge_type,
    amount=1,
):

    now = utc_now()

    amount = max(
        1,
        int(amount or 1),
    )

    challenges = (
        RewardChallenge.query
        .filter(
            RewardChallenge.active.is_(True),
            RewardChallenge.starts_at <= now,
            db.or_(
                RewardChallenge.expires_at.is_(None),
                RewardChallenge.expires_at > now,
            ),
            RewardChallenge.challenge_type
            == challenge_type,
        )
        .all()
    )

    for challenge in challenges:

        user_challenge = (
            UserChallenge.query
            .filter_by(
                user_id=user.id,
                challenge_id=challenge.id,
            )
            .first()
        )

        if user_challenge is None:

            user_challenge = UserChallenge(
                user_id=user.id,
                challenge_id=challenge.id,
                progress=0,
                completed=False,
                claimed=False,
                started_at=now,
            )

            db.session.add(
                user_challenge
            )

            db.session.flush()

        if user_challenge.claimed:
            continue

        user_challenge.progress = min(
            challenge.target,
            (
                user_challenge.progress or 0
            ) + amount,
        )

        if (
            user_challenge.progress
            >= challenge.target
        ):

            user_challenge.completed = True

            if user_challenge.completed_at is None:

                user_challenge.completed_at = now


# =========================================================
# SYNCO EVENT -> MISSION SYNC
# =========================================================

def sync_completed_synco_missions(user):

    if user is None:
        return

    if is_profile_complete(user):

        update_challenge_progress(
            user,
            "PROFILE_COMPLETED",
            1,
        )

    if (
        ProfileGame.query
        .filter_by(
            user_id=user.id
        )
        .count()
        >= 1
    ):

        update_challenge_progress(
            user,
            "GAME_ADDED",
            1,
        )

    if (
        Friendship.query
        .filter_by(
            user_id=user.id
        )
        .count()
        >= 1
    ):

        update_challenge_progress(
            user,
            "FRIENDSHIP_CREATED",
            1,
        )

    if (
        ClubMember.query
        .filter_by(
            user_id=user.id
        )
        .count()
        >= 1
    ):

        update_challenge_progress(
            user,
            "CLUB_JOINED",
            1,
        )

    if (
        ProfileClip.query
        .filter_by(
            user_id=user.id
        )
        .count()
        >= 1
    ):

        update_challenge_progress(
            user,
            "CLIP_UPLOADED",
            1,
        )


# =========================================================
# ACHIEVEMENTS
# =========================================================

def check_achievement(
    user,
    achievement,
):

    if not achievement.active:
        return False

    existing = (
        UserAchievement.query
        .filter_by(
            user_id=user.id,
            achievement_id=achievement.id,
        )
        .first()
    )

    if existing:
        return False

    progress = get_achievement_progress(
        user,
        achievement,
    )

    requirement_value = (
        achievement.requirement_value
        or 1
    )

    if progress < requirement_value:
        return False

    unlocked = UserAchievement(
        user_id=user.id,
        achievement_id=achievement.id,
        unlocked_at=utc_now(),
    )

    db.session.add(
        unlocked
    )

    if achievement.reward_xp:

        user.xp = (
            user.xp or 0
        ) + achievement.reward_xp

        create_transaction(
            user_id=user.id,
            transaction_type="ACHIEVEMENT_XP",
            xp_amount=achievement.reward_xp,
            credits_amount=0,
            description=(
                f"Achievement unlocked: "
                f"{achievement.title}"
            ),
            reference_type="ACHIEVEMENT",
            reference_id=achievement.id,
        )

    if achievement.reward_credits:

        user.credits = (
            user.credits or 0
        ) + achievement.reward_credits

        create_transaction(
            user_id=user.id,
            transaction_type="ACHIEVEMENT_CREDITS",
            xp_amount=0,
            credits_amount=achievement.reward_credits,
            description=(
                f"Achievement unlocked: "
                f"{achievement.title}"
            ),
            reference_type="ACHIEVEMENT",
            reference_id=achievement.id,
        )

    update_level(user)

    return True


def check_all_achievements(user):

    achievements = (
        Achievement.query
        .filter_by(
            active=True
        )
        .all()
    )

    unlocked_any = False

    for achievement in achievements:

        if check_achievement(
            user,
            achievement,
        ):
            unlocked_any = True

    return unlocked_any


# =========================================================
# LEGACY GAME ACTIVITY
# =========================================================

def process_game_activity(
    user,
    action,
    amount=1,
    reference_id=None,
):

    if user is None:
        return False

    action = (
        action or ""
    ).upper()

    valid_actions = {
        "MATCH",
        "MATCH_WIN",
        "TOURNAMENT",
        "TOURNAMENT_WIN",
    }

    if action not in valid_actions:
        return False

    amount = max(
        1,
        int(amount or 1),
    )

    update_streak(user)

    for index in range(amount):

        if reference_id is not None:

            current_reference_id = (
                reference_id
            )

        else:

            current_reference_id = (
                f"{action}_"
                f"{user.id}_"
                f"{utc_now().timestamp()}_"
                f"{index}"
            )

        if action == "MATCH":

            award_rewards(
                user,
                xp=25,
                credits=5,
                description="Match played",
                reference_type="MATCH",
                reference_id=current_reference_id,
            )

            update_challenge_progress(
                user,
                "MATCH",
                1,
            )

        elif action == "MATCH_WIN":

            award_rewards(
                user,
                xp=75,
                credits=15,
                description="Match victory",
                reference_type="MATCH_WIN",
                reference_id=current_reference_id,
            )

            update_challenge_progress(
                user,
                "MATCH_WIN",
                1,
            )

        elif action == "TOURNAMENT":

            award_rewards(
                user,
                xp=100,
                credits=25,
                description="Tournament played",
                reference_type="TOURNAMENT",
                reference_id=current_reference_id,
            )

            update_challenge_progress(
                user,
                "TOURNAMENT",
                1,
            )

        elif action == "TOURNAMENT_WIN":

            award_rewards(
                user,
                xp=250,
                credits=75,
                description="Tournament victory",
                reference_type="TOURNAMENT_WIN",
                reference_id=current_reference_id,
            )

            update_challenge_progress(
                user,
                "TOURNAMENT_WIN",
                1,
            )

    check_all_achievements(user)

    db.session.commit()

    return True


# =========================================================
# GET REWARDS DASHBOARD
# =========================================================

@rewards_bp.route(
    "",
    methods=["GET"],
)
def get_rewards():

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        # -------------------------------------------------
        # SEED
        # -------------------------------------------------

        seed_reward_challenges()

        seed_reward_store()

        seed_achievements()

        # -------------------------------------------------
        # DAILY LOGIN
        # -------------------------------------------------

        process_daily_login(user)

        # -------------------------------------------------
        # USER CHALLENGES
        # -------------------------------------------------

        initialize_user_challenges(user)

        # -------------------------------------------------
        # SYNCO ACTIONS
        # -------------------------------------------------

        sync_completed_synco_missions(
            user
        )

        # -------------------------------------------------
        # ACHIEVEMENTS
        # -------------------------------------------------

        check_all_achievements(user)

        db.session.commit()

        now = utc_now()

        # -------------------------------------------------
        # TOTAL XP
        # -------------------------------------------------

        total_xp_earned = (
            db.session.query(
                db.func.coalesce(
                    db.func.sum(
                        RewardTransaction.xp_amount
                    ),
                    0,
                )
            )
            .filter(
                RewardTransaction.user_id
                == user.id,
                RewardTransaction.xp_amount
                > 0,
            )
            .scalar()
        )

        # -------------------------------------------------
        # CURRENT LEVEL
        # -------------------------------------------------

        current_level_xp = (
            user.xp or 0
        )

        level_requirement = (
            xp_required_for_level(
                user.level or 1
            )
        )

        progress_percentage = (
            (
                current_level_xp
                / level_requirement
            ) * 100
            if level_requirement > 0
            else 0
        )

        # -------------------------------------------------
        # ACTIVE CHALLENGES
        # -------------------------------------------------

        active_challenges = (
            RewardChallenge.query
            .filter(
                RewardChallenge.active.is_(True),
                RewardChallenge.starts_at <= now,
                db.or_(
                    RewardChallenge.expires_at.is_(None),
                    RewardChallenge.expires_at > now,
                ),
            )
            .all()
        )

        missions = []

        daily_challenges = []

        weekly_challenges = []

        # -------------------------------------------------
        # MISSION REFERENCE MAP
        # -------------------------------------------------

        mission_reference_map = {

            "PROFILE_COMPLETED":
                "PROFILE_COMPLETED",

            "GAME_ADDED":
                "FIRST_GAME",

            "FRIENDSHIP_CREATED":
                "FIRST_FRIENDSHIP",

            "CLUB_JOINED":
                "FIRST_CLUB",

            "CLIP_UPLOADED":
                "FIRST_CLIP",

        }

        for challenge in active_challenges:

            user_challenge = (
                UserChallenge.query
                .filter_by(
                    user_id=user.id,
                    challenge_id=challenge.id,
                )
                .first()
            )

            serialized = serialize_challenge(
                challenge,
                user_challenge,
            )

            # =================================================
            # ONE-TIME
            # =================================================

            if challenge.period == "ONCE":

                reference_id = (
                    mission_reference_map.get(
                        challenge.challenge_type
                    )
                )

                rewarded = (
                    transaction_exists(
                        user.id,
                        "MISSION",
                        reference_id,
                    )
                    if reference_id
                    else False
                )

                if rewarded:

                    serialized["progress"] = (
                        challenge.target
                    )

                    serialized["completed"] = True

                    serialized["claimed"] = True

                missions.append(
                    serialized
                )

            # =================================================
            # DAILY
            # =================================================

            elif challenge.period == "DAILY":

                daily_challenges.append(
                    serialized
                )

            # =================================================
            # WEEKLY
            # =================================================

            elif challenge.period in (
                "WEEKLY",
                "WEEKLY_DAILY",
            ):

                weekly_challenges.append(
                    serialized
                )

        # -------------------------------------------------
        # INVENTORY
        # -------------------------------------------------

        inventory = (
            UserInventory.query
            .filter_by(
                user_id=user.id
            )
            .all()
        )

        inventory_map = {
            item.reward_item_id:
                item.quantity
            for item in inventory
        }

        # -------------------------------------------------
        # STORE
        # -------------------------------------------------

        store_items = (
            RewardItem.query
            .filter_by(
                active=True
            )
            .all()
        )

        store_rewards = [

            serialize_store_item(
                item,
                inventory_map.get(
                    item.id,
                    0,
                ),
            )

            for item in store_items

        ]

        # -------------------------------------------------
        # ACHIEVEMENTS
        # -------------------------------------------------

        achievement_records = (
            Achievement.query
            .filter_by(
                active=True
            )
            .all()
        )

        achievements = [

            serialize_achievement(
                user,
                achievement,
            )

            for achievement
            in achievement_records

        ]

        # -------------------------------------------------
        # HISTORY
        # -------------------------------------------------

        transactions = (
            RewardTransaction.query
            .filter_by(
                user_id=user.id
            )
            .order_by(
                RewardTransaction.created_at.desc()
            )
            .limit(10)
            .all()
        )

        recent_rewards = [

            serialize_transaction(
                transaction
            )

            for transaction
            in transactions

        ]

        # -------------------------------------------------
        # RESPONSE
        # -------------------------------------------------

        return jsonify({

            "success": True,

            "user": {

                "id": user.id,

                "name": user.name,

                "username": user.username,

                "avatar": user.avatar,

                "xp": user.xp or 0,

                "level": user.level or 1,

                "credits": user.credits or 0,

                "currentStreak": (
                    user.current_streak or 0
                ),

                "longestStreak": (
                    user.longest_streak or 0
                ),

                "totalXpEarned": (
                    total_xp_earned or 0
                ),

                "levelXp": (
                    current_level_xp
                ),

                "levelXpRequired": (
                    level_requirement
                ),

                "xpProgress": round(
                    min(
                        progress_percentage,
                        100,
                    ),
                    2,
                ),

            },

            "missions": missions,

            "dailyChallenges": (
                daily_challenges
            ),

            "weeklyChallenges": (
                weekly_challenges
            ),

            "storeRewards": (
                store_rewards
            ),

            "achievements": (
                achievements
            ),

            "recentRewards": (
                recent_rewards
            ),

            "inventory": [

                serialize_inventory(
                    item
                )

                for item in inventory

            ],

        })

    except Exception as e:

        db.session.rollback()

        print(
            "Rewards GET Error:",
            repr(e),
        )

        return jsonify({

            "success": False,

            "message": (
                "Unable to load rewards."
            ),

            "error": str(e),

        }), 500


# =========================================================
# CLAIM CHALLENGE
# =========================================================

@rewards_bp.route(
    "/challenges/<int:challenge_id>/claim",
    methods=["POST"],
)
def claim_challenge(
    challenge_id,
):

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        challenge = db.session.get(
            RewardChallenge,
            challenge_id,
        )

        if challenge is None:

            return jsonify({
                "success": False,
                "message": "Challenge not found.",
            }), 404

        now = utc_now()

        if not challenge.active:

            return jsonify({
                "success": False,
                "message": (
                    "This challenge is no longer active."
                ),
            }), 400

        if (
            challenge.starts_at
            and now < challenge.starts_at
        ):

            return jsonify({
                "success": False,
                "message": (
                    "This challenge has not started yet."
                ),
            }), 400

        if (
            challenge.expires_at
            and now >= challenge.expires_at
        ):

            return jsonify({
                "success": False,
                "message": (
                    "This challenge has expired."
                ),
            }), 400

        user_challenge = (
            UserChallenge.query
            .filter_by(
                user_id=user.id,
                challenge_id=challenge.id,
            )
            .first()
        )

        if user_challenge is None:

            user_challenge = UserChallenge(
                user_id=user.id,
                challenge_id=challenge.id,
                progress=0,
                completed=False,
                claimed=False,
                started_at=now,
            )

            db.session.add(
                user_challenge
            )

            db.session.flush()

        # -------------------------------------------------
        # DAILY LOGIN
        # -------------------------------------------------

        if (
            challenge.challenge_type
            == "DAILY_LOGIN"
        ):

            return jsonify({

                "success": False,

                "message": (
                    "Daily login rewards are automatically claimed."
                ),

            }), 400

        # -------------------------------------------------
        # ALREADY CLAIMED
        # -------------------------------------------------

        if user_challenge.claimed:

            return jsonify({

                "success": False,

                "message": (
                    "Challenge already claimed."
                ),

            }), 400

        # -------------------------------------------------
        # REPAIR MISSION
        # -------------------------------------------------

        if challenge.period == "ONCE":

            sync_completed_synco_missions(
                user
            )

            db.session.flush()

        user_challenge = (
            UserChallenge.query
            .filter_by(
                user_id=user.id,
                challenge_id=challenge.id,
            )
            .first()
        )

        if (
            user_challenge is None
            or not user_challenge.completed
        ):

            return jsonify({

                "success": False,

                "message": (
                    "Complete the challenge "
                    "before claiming it."
                ),

                "progress": (
                    user_challenge.progress
                    if user_challenge
                    else 0
                ),

                "target": challenge.target,

            }), 400

        # -------------------------------------------------
        # CHALLENGE REFERENCE
        # -------------------------------------------------

        reference_type = "CHALLENGE"

        reference_id = challenge.id

        # -------------------------------------------------
        # DUPLICATE PROTECTION
        # -------------------------------------------------

        if transaction_exists(
            user.id,
            reference_type,
            reference_id,
        ):

            user_challenge.claimed = True

            user_challenge.claimed_at = now

            db.session.commit()

            return jsonify({

                "success": True,

                "message": (
                    "Challenge reward was already granted."
                ),

                "user": {

                    "xp": user.xp,

                    "level": user.level,

                    "credits": user.credits,

                    "currentStreak": (
                        user.current_streak
                    ),

                },

            })

        # -------------------------------------------------
        # XP
        # -------------------------------------------------

        if challenge.reward_xp:

            user.xp = (
                user.xp or 0
            ) + challenge.reward_xp

            create_transaction(
                user_id=user.id,
                transaction_type="CHALLENGE_XP",
                xp_amount=challenge.reward_xp,
                credits_amount=0,
                description=(
                    f"Challenge completed: "
                    f"{challenge.title}"
                ),
                reference_type=reference_type,
                reference_id=reference_id,
            )

        # -------------------------------------------------
        # CREDITS
        # -------------------------------------------------

        if challenge.reward_credits:

            user.credits = (
                user.credits or 0
            ) + challenge.reward_credits

            create_transaction(
                user_id=user.id,
                transaction_type="CHALLENGE_CREDITS",
                xp_amount=0,
                credits_amount=challenge.reward_credits,
                description=(
                    f"Challenge completed: "
                    f"{challenge.title}"
                ),
                reference_type=reference_type,
                reference_id=reference_id,
            )

        update_level(user)

        user_challenge.claimed = True

        user_challenge.claimed_at = now

        check_all_achievements(user)

        db.session.commit()

        return jsonify({

            "success": True,

            "message": (
                "Challenge reward claimed successfully."
            ),

            "rewards": {

                "xp": (
                    challenge.reward_xp
                    or 0
                ),

                "credits": (
                    challenge.reward_credits
                    or 0
                ),

            },

            "user": {

                "xp": (
                    user.xp or 0
                ),

                "level": (
                    user.level or 1
                ),

                "credits": (
                    user.credits or 0
                ),

                "currentStreak": (
                    user.current_streak or 0
                ),

            },

        })

    except Exception as e:

        db.session.rollback()

        print(
            "Challenge Claim Error:",
            repr(e),
        )

        return jsonify({

            "success": False,

            "message": (
                "Unable to claim challenge."
            ),

            "error": str(e),

        }), 500


# =========================================================
# REDEEM STORE ITEM
# =========================================================

@rewards_bp.route(
    "/store/<int:item_id>/redeem",
    methods=["POST"],
)
def redeem_store_item(
    item_id,
):

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        item = db.session.get(
            RewardItem,
            item_id,
        )

        if item is None:

            return jsonify({
                "success": False,
                "message": (
                    "Reward item not found."
                ),
            }), 404

        if not item.active:

            return jsonify({
                "success": False,
                "message": (
                    "This reward is no longer available."
                ),
            }), 400

        if (
            item.stock is not None
            and item.stock == 0
        ):

            return jsonify({
                "success": False,
                "message": (
                    "This reward is out of stock."
                ),
            }), 400

        price = int(
            item.price or 0
        )

        if (
            user.credits or 0
        ) < price:

            return jsonify({

                "success": False,

                "message": (
                    "Not enough credits."
                ),

                "required": price,

                "available": (
                    user.credits or 0
                ),

            }), 400

        # -------------------------------------------------
        # INVENTORY
        # -------------------------------------------------

        inventory_item = (
            UserInventory.query
            .filter_by(
                user_id=user.id,
                reward_item_id=item.id,
            )
            .first()
        )

        if inventory_item is None:

            inventory_item = UserInventory(
                user_id=user.id,
                reward_item_id=item.id,
                quantity=0,
                acquired_at=utc_now(),
            )

            db.session.add(
                inventory_item
            )

        inventory_item.quantity += 1

        # -------------------------------------------------
        # STOCK
        # -------------------------------------------------

        if (
            item.stock is not None
            and item.stock > 0
        ):

            item.stock -= 1

        # -------------------------------------------------
        # UNIQUE STORE REFERENCE
        # -------------------------------------------------

        raw_store_reference = (
            f"{item.id}-"
            f"{user.id}-"
            f"{utc_now().timestamp()}"
        )

        store_reference_id = (
            normalize_reference_id(
                "STORE",
                raw_store_reference,
            )
        )

        # -------------------------------------------------
        # SPEND CREDITS
        # -------------------------------------------------

        spend_success = spend_credits(
            user,
            price,
            description=(
                f"Redeemed reward: "
                f"{item.title}"
            ),
            reference_type="STORE",
            reference_id=store_reference_id,
        )

        if not spend_success:

            db.session.rollback()

            return jsonify({
                "success": False,
                "message": (
                    "Unable to process purchase."
                ),
            }), 400

        db.session.commit()

        return jsonify({

            "success": True,

            "message": (
                "Reward redeemed successfully."
            ),

            "item": serialize_store_item(
                item,
                inventory_item.quantity,
            ),

            "user": {

                "credits": (
                    user.credits
                ),

                "xp": (
                    user.xp
                ),

                "level": (
                    user.level
                ),

            },

        })

    except Exception as e:

        db.session.rollback()

        print(
            "Store Redeem Error:",
            repr(e),
        )

        return jsonify({

            "success": False,

            "message": (
                "Unable to redeem reward."
            ),

            "error": str(e),

        }), 500


# =========================================================
# INVENTORY
# =========================================================

@rewards_bp.route(
    "/inventory",
    methods=["GET"],
)
def get_inventory():

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        inventory = (
            UserInventory.query
            .filter_by(
                user_id=user.id
            )
            .order_by(
                UserInventory.acquired_at.desc()
            )
            .all()
        )

        return jsonify({

            "success": True,

            "inventory": [

                serialize_inventory(
                    item
                )

                for item in inventory

            ],

        })

    except Exception as e:

        db.session.rollback()

        print(
            "Inventory Error:",
            repr(e),
        )

        return jsonify({

            "success": False,

            "message": (
                "Unable to load inventory."
            ),

            "error": str(e),

        }), 500


# =========================================================
# HISTORY
# =========================================================

@rewards_bp.route(
    "/history",
    methods=["GET"],
)
def get_reward_history():

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        transactions = (
            RewardTransaction.query
            .filter_by(
                user_id=user.id
            )
            .order_by(
                RewardTransaction.created_at.desc()
            )
            .limit(50)
            .all()
        )

        return jsonify({

            "success": True,

            "history": [

                serialize_transaction(
                    transaction
                )

                for transaction
                in transactions

            ],

        })

    except Exception as e:

        db.session.rollback()

        print(
            "Reward History Error:",
            repr(e),
        )

        return jsonify({

            "success": False,

            "message": (
                "Unable to load reward history."
            ),

            "error": str(e),

        }), 500


# =========================================================
# ACHIEVEMENTS
# =========================================================

@rewards_bp.route(
    "/achievements",
    methods=["GET"],
)
def get_achievements():

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        seed_achievements()

        check_all_achievements(user)

        db.session.commit()

        achievements = (
            Achievement.query
            .filter_by(
                active=True
            )
            .all()
        )

        return jsonify({

            "success": True,

            "achievements": [

                serialize_achievement(
                    user,
                    achievement,
                )

                for achievement
                in achievements

            ],

        })

    except Exception as e:

        db.session.rollback()

        print(
            "Achievements Error:",
            repr(e),
        )

        return jsonify({

            "success": False,

            "message": (
                "Unable to load achievements."
            ),

            "error": str(e),

        }), 500


# =========================================================
# DEBUG GAME ACTIVITY
# =========================================================

@rewards_bp.route(
    "/debug/activity/<action>",
    methods=["POST"],
)
def debug_game_activity(action):

    from flask import current_app

    if not current_app.debug:

        return jsonify({

            "success": False,

            "message": (
                "Debug endpoint disabled."
            ),

        }), 404

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        success = process_game_activity(
            user=user,
            action=action,
            amount=1,
            reference_id=None,
        )

        if not success:

            return jsonify({

                "success": False,

                "message": (
                    "Invalid activity type."
                ),

            }), 400

        return jsonify({

            "success": True,

            "message": (
                f"{action.upper()} activity processed."
            ),

            "user": {

                "xp": (
                    user.xp or 0
                ),

                "level": (
                    user.level or 1
                ),

                "credits": (
                    user.credits or 0
                ),

                "currentStreak": (
                    user.current_streak or 0
                ),

                "longestStreak": (
                    user.longest_streak or 0
                ),

            },

        })

    except Exception as e:

        db.session.rollback()

        print(
            "Debug Activity Error:",
            repr(e),
        )

        return jsonify({

            "success": False,

            "message": (
                "Unable to process activity."
            ),

            "error": str(e),

        }), 500