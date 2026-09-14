# rewards.py

from datetime import datetime, timedelta

from flask import Blueprint, jsonify, session

from models import (
    db,
    User,
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
    """
    Get the currently authenticated user from the Flask session.
    """

    session_user = session.get("user")

    if not session_user:
        return None

    user_id = session_user.get("id")

    if not user_id:
        return None

    return db.session.get(User, user_id)


def auth_required_response():
    return jsonify({
        "success": False,
        "message": "Authentication required."
    }), 401


# =========================================================
# REWARD TRANSACTION HELPERS
# =========================================================

def create_transaction(
    user_id,
    transaction_type,
    xp_amount=0,
    credits_amount=0,
    description=None,
    reference_type=None,
    reference_id=None,
):
    transaction = RewardTransaction(
        user_id=user_id,
        transaction_type=transaction_type,
        xp_amount=xp_amount,
        credits_amount=credits_amount,
        description=description,
        reference_type=reference_type,
        reference_id=reference_id,
    )

    db.session.add(transaction)

    return transaction


def add_xp(
    user,
    amount,
    description=None,
    reference_type=None,
    reference_id=None,
):
    if amount <= 0:
        return

    user.xp += amount

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


def add_credits(
    user,
    amount,
    description=None,
    reference_type=None,
    reference_id=None,
):
    if amount <= 0:
        return

    user.credits += amount

    create_transaction(
        user_id=user.id,
        transaction_type="CREDITS_EARNED",
        xp_amount=0,
        credits_amount=amount,
        description=description,
        reference_type=reference_type,
        reference_id=reference_id,
    )


def spend_credits(
    user,
    amount,
    description=None,
    reference_type=None,
    reference_id=None,
):
    if amount <= 0:
        return

    user.credits -= amount

    create_transaction(
        user_id=user.id,
        transaction_type="CREDITS_SPENT",
        xp_amount=0,
        credits_amount=-amount,
        description=description,
        reference_type=reference_type,
        reference_id=reference_id,
    )


# =========================================================
# LEVEL SYSTEM
# =========================================================

def xp_required_for_level(level):
    """
    XP required to move from the given level to the next level.

    Example:
    Level 1 -> 100 XP
    Level 2 -> 200 XP
    Level 3 -> 300 XP
    """

    return level * 100


def update_level(user):
    """
    Automatically update the user's level based on XP.
    """

    while user.xp >= xp_required_for_level(user.level):
        required = xp_required_for_level(user.level)

        user.xp -= required
        user.level += 1


# =========================================================
# STREAK SYSTEM
# =========================================================

def update_streak(user):
    """
    Update daily activity streak.

    A user can only increase their streak once per calendar day.
    """

    now = datetime.utcnow()

    if user.last_activity_at is None:
        user.current_streak = 1
        user.longest_streak = max(
            user.longest_streak or 0,
            user.current_streak,
        )

    else:
        last_date = user.last_activity_at.date()
        current_date = now.date()

        if last_date == current_date:
            return

        difference = (current_date - last_date).days

        if difference == 1:
            user.current_streak += 1
        else:
            user.current_streak = 1

        user.longest_streak = max(
            user.longest_streak or 0,
            user.current_streak,
        )

    user.last_activity_at = now


# =========================================================
# SERIALIZATION
# =========================================================

def serialize_challenge(challenge, user_challenge=None):
    progress = 0
    completed = False
    claimed = False

    if user_challenge:
        progress = user_challenge.progress or 0
        completed = bool(user_challenge.completed)
        claimed = bool(user_challenge.claimed)

    return {
        "id": challenge.id,
        "title": challenge.title,
        "description": challenge.description,
        "challengeType": challenge.challenge_type,
        "target": challenge.target,
        "progress": progress,
        "completed": completed,
        "claimed": claimed,

        "rewardXp": challenge.reward_xp,
        "rewardCredits": challenge.reward_credits,

        # Compatibility with older frontend naming
        "xpReward": challenge.reward_xp,
        "creditReward": challenge.reward_credits,

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


def serialize_store_item(item, inventory_quantity=0):
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

        "owned": inventory_quantity > 0,
        "quantity": inventory_quantity,
    }


def serialize_inventory(inventory):
    item = inventory.reward_item

    return {
        "id": inventory.id,
        "rewardItemId": inventory.reward_item_id,
        "itemId": inventory.reward_item_id,

        "title": item.title if item else None,
        "name": item.title if item else None,

        "description": item.description if item else None,

        "itemType": item.item_type if item else None,
        "type": item.item_type if item else None,

        "icon": item.icon if item else None,

        "quantity": inventory.quantity,
        "acquiredAt": (
            inventory.acquired_at.isoformat()
            if inventory.acquired_at
            else None
        ),
    }


def get_achievement_progress(user, achievement):
    """
    Calculate live achievement progress.

    UserAchievement does not store a progress column, so progress
    is calculated from the user's actual reward activity.
    """

    requirement = (achievement.requirement_type or "").upper()

    if requirement == "MATCH_WINS":
        return (
            RewardTransaction.query
            .filter(
                RewardTransaction.user_id == user.id,
                RewardTransaction.reference_type == "MATCH_WIN",
                RewardTransaction.xp_amount > 0,
            )
            .count()
        )

    if requirement == "MATCHES_PLAYED":
        return (
            RewardTransaction.query
            .filter(
                RewardTransaction.user_id == user.id,
                RewardTransaction.reference_type == "MATCH",
                RewardTransaction.xp_amount > 0,
            )
            .count()
        )

    if requirement == "TOURNAMENTS_PLAYED":
        return (
            RewardTransaction.query
            .filter(
                RewardTransaction.user_id == user.id,
                RewardTransaction.reference_type == "TOURNAMENT",
                RewardTransaction.xp_amount > 0,
            )
            .count()
        )

    if requirement == "TOURNAMENT_WINS":
        return (
            RewardTransaction.query
            .filter(
                RewardTransaction.user_id == user.id,
                RewardTransaction.reference_type == "TOURNAMENT_WIN",
                RewardTransaction.xp_amount > 0,
            )
            .count()
        )

    if requirement == "STREAK":
        return user.current_streak or 0

    if requirement == "LEVEL":
        return user.level or 1

    if requirement == "XP":
        return user.xp or 0

    if requirement == "CREDITS":
        return user.credits or 0

    return 0


def serialize_achievement(user, achievement):
    unlocked_record = (
        UserAchievement.query
        .filter_by(
            user_id=user.id,
            achievement_id=achievement.id,
        )
        .first()
    )

    unlocked = unlocked_record is not None

    progress = get_achievement_progress(
        user,
        achievement,
    )

    return {
        "id": achievement.id,
        "title": achievement.title,
        "name": achievement.title,

        "description": achievement.description,

        "requirementType": achievement.requirement_type,
        "requirementValue": achievement.requirement_value,

        "progress": min(
            progress,
            achievement.requirement_value,
        ),

        "unlocked": unlocked,

        "rewardXp": achievement.reward_xp,
        "rewardCredits": achievement.reward_credits,

        "icon": achievement.icon,
        "active": achievement.active,

        "unlockedAt": (
            unlocked_record.unlocked_at.isoformat()
            if unlocked_record and unlocked_record.unlocked_at
            else None
        ),
    }


def serialize_transaction(transaction):
    """
    Keep both detailed XP/credit values and a simple amount field
    for frontend compatibility.
    """

    if transaction.xp_amount:
        amount = transaction.xp_amount
    else:
        amount = transaction.credits_amount or 0

    return {
        "id": transaction.id,

        "transactionType": transaction.transaction_type,

        "xpAmount": transaction.xp_amount or 0,
        "creditsAmount": transaction.credits_amount or 0,

        "amount": amount,

        "description": transaction.description,

        "referenceType": transaction.reference_type,
        "referenceId": transaction.reference_id,

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
    now = datetime.utcnow()

    daily_exists = (
        RewardChallenge.query
        .filter(
            RewardChallenge.period == "DAILY",
            RewardChallenge.active.is_(True),
            RewardChallenge.expires_at > now,
        )
        .count()
        > 0
    )

    weekly_exists = (
        RewardChallenge.query
        .filter(
            RewardChallenge.period == "WEEKLY",
            RewardChallenge.active.is_(True),
            RewardChallenge.expires_at > now,
        )
        .count()
        > 0
    )

    weekly_daily_exists = (
        RewardChallenge.query
        .filter(
            RewardChallenge.period == "WEEKLY_DAILY",
            RewardChallenge.active.is_(True),
            RewardChallenge.expires_at > now,
        )
        .count()
        > 0
    )

    if not daily_exists:
        daily_challenges = [
            {
                "title": "First Match",
                "description": "Play 1 match today.",
                "challenge_type": "MATCH",
                "target": 1,
                "reward_xp": 100,
                "reward_credits": 25,
                "period": "DAILY",
                "icon": "gamepad",
            },
            {
                "title": "Warm Up",
                "description": "Play 3 matches today.",
                "challenge_type": "MATCH",
                "target": 3,
                "reward_xp": 200,
                "reward_credits": 50,
                "period": "DAILY",
                "icon": "target",
            },
            {
                "title": "Daily Winner",
                "description": "Win 1 match today.",
                "challenge_type": "MATCH_WIN",
                "target": 1,
                "reward_xp": 250,
                "reward_credits": 75,
                "period": "DAILY",
                "icon": "trophy",
            },
        ]

        for data in daily_challenges:
            db.session.add(
                RewardChallenge(
                    title=data["title"],
                    description=data["description"],
                    challenge_type=data["challenge_type"],
                    target=data["target"],
                    reward_xp=data["reward_xp"],
                    reward_credits=data["reward_credits"],
                    period=data["period"],
                    icon=data["icon"],
                    active=True,
                    starts_at=now,
                    expires_at=now + timedelta(days=1),
                )
            )

    if not weekly_exists:
        weekly_challenges = [
            {
                "title": "Weekly Grinder",
                "description": "Play 15 matches this week.",
                "challenge_type": "MATCH",
                "target": 15,
                "reward_xp": 750,
                "reward_credits": 200,
                "period": "WEEKLY",
                "icon": "gamepad",
            },
            {
                "title": "Weekly Champion",
                "description": "Win 5 matches this week.",
                "challenge_type": "MATCH_WIN",
                "target": 5,
                "reward_xp": 1000,
                "reward_credits": 300,
                "period": "WEEKLY",
                "icon": "trophy",
            },
        ]

        for data in weekly_challenges:
            db.session.add(
                RewardChallenge(
                    title=data["title"],
                    description=data["description"],
                    challenge_type=data["challenge_type"],
                    target=data["target"],
                    reward_xp=data["reward_xp"],
                    reward_credits=data["reward_credits"],
                    period=data["period"],
                    icon=data["icon"],
                    active=True,
                    starts_at=now,
                    expires_at=now + timedelta(days=7),
                )
            )

    if not weekly_daily_exists:
        db.session.add(
            RewardChallenge(
                title="Daily Challenger",
                description="Complete 5 daily challenges this week.",
                challenge_type="WEEKLY_DAILY",
                target=5,
                reward_xp=500,
                reward_credits=150,
                period="WEEKLY_DAILY",
                icon="calendar",
                active=True,
                starts_at=now,
                expires_at=now + timedelta(days=7),
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
            "description": "Unlock a premium profile frame.",
            "price": 500,
            "item_type": "PROFILE_FRAME",
            "icon": "frame",
            "stock": -1,
        },
        {
            "title": "XP Boost",
            "description": "A reward item for your inventory.",
            "price": 750,
            "item_type": "XP_BOOST",
            "icon": "zap",
            "stock": -1,
        },
        {
            "title": "Exclusive Badge",
            "description": "Show off an exclusive SYNCO badge.",
            "price": 1000,
            "item_type": "BADGE",
            "icon": "badge",
            "stock": -1,
        },
        {
            "title": "Premium Title",
            "description": "Unlock a premium player title.",
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
                description=data["description"],
                price=data["price"],
                item_type=data["item_type"],
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
    if Achievement.query.count() > 0:
        return

    achievements = [
        {
            "title": "First Blood",
            "description": "Win your first match.",
            "requirement_type": "MATCH_WINS",
            "requirement_value": 1,
            "reward_xp": 250,
            "reward_credits": 50,
            "icon": "target",
        },
        {
            "title": "Competitive Player",
            "description": "Play 10 matches.",
            "requirement_type": "MATCHES_PLAYED",
            "requirement_value": 10,
            "reward_xp": 500,
            "reward_credits": 100,
            "icon": "gamepad",
        },
        {
            "title": "Tournament Ready",
            "description": "Play 5 tournaments.",
            "requirement_type": "TOURNAMENTS_PLAYED",
            "requirement_value": 5,
            "reward_xp": 750,
            "reward_credits": 150,
            "icon": "trophy",
        },
        {
            "title": "Tournament Champion",
            "description": "Win 3 tournaments.",
            "requirement_type": "TOURNAMENT_WINS",
            "requirement_value": 3,
            "reward_xp": 1000,
            "reward_credits": 250,
            "icon": "crown",
        },
        {
            "title": "7 Day Streak",
            "description": "Maintain a 7 day activity streak.",
            "requirement_type": "STREAK",
            "requirement_value": 7,
            "reward_xp": 500,
            "reward_credits": 100,
            "icon": "flame",
        },
    ]

    for data in achievements:
        db.session.add(
            Achievement(
                title=data["title"],
                description=data["description"],
                requirement_type=data["requirement_type"],
                requirement_value=data["requirement_value"],
                reward_xp=data["reward_xp"],
                reward_credits=data["reward_credits"],
                icon=data["icon"],
                active=True,
            )
        )

    db.session.commit()


# =========================================================
# INITIALIZE USER CHALLENGES
# =========================================================

def initialize_user_challenges(user):
    now = datetime.utcnow()

    challenges = (
        RewardChallenge.query
        .filter(
            RewardChallenge.active.is_(True),
            RewardChallenge.starts_at <= now,
            RewardChallenge.expires_at > now,
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
# CHALLENGE PROGRESS
# =========================================================

def update_challenge_progress(
    user,
    challenge_type,
    amount=1,
):
    now = datetime.utcnow()

    challenges = (
        RewardChallenge.query
        .filter(
            RewardChallenge.active.is_(True),
            RewardChallenge.starts_at <= now,
            RewardChallenge.expires_at > now,
            RewardChallenge.challenge_type == challenge_type,
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

            db.session.add(user_challenge)

        if user_challenge.claimed:
            continue

        user_challenge.progress = min(
            challenge.target,
            user_challenge.progress + amount,
        )

        if user_challenge.progress >= challenge.target:
            user_challenge.completed = True

            if user_challenge.completed_at is None:
                user_challenge.completed_at = now


def update_weekly_daily_challenge(user):
    now = datetime.utcnow()

    challenge = (
        RewardChallenge.query
        .filter(
            RewardChallenge.active.is_(True),
            RewardChallenge.period == "WEEKLY_DAILY",
            RewardChallenge.starts_at <= now,
            RewardChallenge.expires_at > now,
        )
        .first()
    )

    if challenge is None:
        return

    completed_daily_count = (
        UserChallenge.query
        .join(RewardChallenge)
        .filter(
            UserChallenge.user_id == user.id,
            UserChallenge.completed.is_(True),
            RewardChallenge.period == "DAILY",
        )
        .count()
    )

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
        db.session.add(user_challenge)

    user_challenge.progress = min(
        challenge.target,
        completed_daily_count,
    )

    if user_challenge.progress >= challenge.target:
        user_challenge.completed = True

        if user_challenge.completed_at is None:
            user_challenge.completed_at = now


# =========================================================
# ACHIEVEMENTS
# =========================================================

def check_achievement(user, achievement):
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

    if progress < achievement.requirement_value:
        return False

    unlocked = UserAchievement(
        user_id=user.id,
        achievement_id=achievement.id,
        unlocked_at=datetime.utcnow(),
    )

    db.session.add(unlocked)

    if achievement.reward_xp:
        add_xp(
            user,
            achievement.reward_xp,
            description=f"Achievement unlocked: {achievement.title}",
            reference_type="ACHIEVEMENT",
            reference_id=achievement.id,
        )

    if achievement.reward_credits:
        add_credits(
            user,
            achievement.reward_credits,
            description=f"Achievement unlocked: {achievement.title}",
            reference_type="ACHIEVEMENT",
            reference_id=achievement.id,
        )

    return True


def check_all_achievements(user):
    achievements = (
        Achievement.query
        .filter_by(active=True)
        .all()
    )

    for achievement in achievements:
        check_achievement(
            user,
            achievement,
        )


# =========================================================
# GAME ACTIVITY
# =========================================================

def process_game_activity(
    user,
    action,
    amount=1,
    reference_id=None,
):
    """
    Call this function from the game/tournament system whenever
    the user performs a relevant activity.

    Supported actions:

    MATCH
    MATCH_WIN
    TOURNAMENT
    TOURNAMENT_WIN
    """

    action = (action or "").upper()

    valid_actions = {
        "MATCH",
        "MATCH_WIN",
        "TOURNAMENT",
        "TOURNAMENT_WIN",
    }

    if action not in valid_actions:
        return False

    amount = max(1, int(amount))

    update_streak(user)

    for _ in range(amount):

        # ---------------------------------------------
        # Match
        # ---------------------------------------------

        if action == "MATCH":
            add_xp(
                user,
                25,
                description="Match played",
                reference_type="MATCH",
                reference_id=reference_id,
            )

            add_credits(
                user,
                5,
                description="Match played",
                reference_type="MATCH",
                reference_id=reference_id,
            )

            update_challenge_progress(
                user,
                "MATCH",
                1,
            )

        # ---------------------------------------------
        # Match Win
        # ---------------------------------------------

        elif action == "MATCH_WIN":
            add_xp(
                user,
                75,
                description="Match victory",
                reference_type="MATCH_WIN",
                reference_id=reference_id,
            )

            add_credits(
                user,
                15,
                description="Match victory",
                reference_type="MATCH_WIN",
                reference_id=reference_id,
            )

            update_challenge_progress(
                user,
                "MATCH_WIN",
                1,
            )

        # ---------------------------------------------
        # Tournament
        # ---------------------------------------------

        elif action == "TOURNAMENT":
            add_xp(
                user,
                100,
                description="Tournament played",
                reference_type="TOURNAMENT",
                reference_id=reference_id,
            )

            add_credits(
                user,
                25,
                description="Tournament played",
                reference_type="TOURNAMENT",
                reference_id=reference_id,
            )

            update_challenge_progress(
                user,
                "TOURNAMENT",
                1,
            )

        # ---------------------------------------------
        # Tournament Win
        # ---------------------------------------------

        elif action == "TOURNAMENT_WIN":
            add_xp(
                user,
                250,
                description="Tournament victory",
                reference_type="TOURNAMENT_WIN",
                reference_id=reference_id,
            )

            add_credits(
                user,
                75,
                description="Tournament victory",
                reference_type="TOURNAMENT_WIN",
                reference_id=reference_id,
            )

            update_challenge_progress(
                user,
                "TOURNAMENT_WIN",
                1,
            )

    update_weekly_daily_challenge(user)

    check_all_achievements(user)

    db.session.commit()

    return True


# =========================================================
# GET REWARDS DASHBOARD
# =========================================================

@rewards_bp.route("", methods=["GET"])
def get_rewards():
    try:
        user = get_current_user()

        if user is None:
            return auth_required_response()

        # Make sure seed data exists.
        seed_reward_challenges()
        seed_reward_store()
        seed_achievements()

        # Assign currently active challenges to this user.
        initialize_user_challenges(user)

        update_weekly_daily_challenge(user)

        db.session.commit()

        now = datetime.utcnow()

        # -------------------------------------------------
        # USER
        # -------------------------------------------------

        total_xp_earned = (
            db.session.query(
                db.func.coalesce(
                    db.func.sum(RewardTransaction.xp_amount),
                    0,
                )
            )
            .filter(
                RewardTransaction.user_id == user.id,
                RewardTransaction.xp_amount > 0,
            )
            .scalar()
        )

        current_level_xp = user.xp or 0

        level_requirement = xp_required_for_level(
            user.level
        )

        progress_percentage = (
            current_level_xp / level_requirement * 100
            if level_requirement > 0
            else 0
        )

        # -------------------------------------------------
        # CHALLENGES
        # -------------------------------------------------

        active_challenges = (
            RewardChallenge.query
            .filter(
                RewardChallenge.active.is_(True),
                RewardChallenge.starts_at <= now,
                RewardChallenge.expires_at > now,
            )
            .all()
        )

        daily_challenges = []
        weekly_challenges = []

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

            if challenge.period == "DAILY":
                daily_challenges.append(serialized)

            elif challenge.period in (
                "WEEKLY",
                "WEEKLY_DAILY",
            ):
                weekly_challenges.append(serialized)

        # -------------------------------------------------
        # STORE
        # -------------------------------------------------

        inventory = (
            UserInventory.query
            .filter_by(user_id=user.id)
            .all()
        )

        inventory_map = {
            item.reward_item_id: item.quantity
            for item in inventory
        }

        store_items = (
            RewardItem.query
            .filter_by(active=True)
            .all()
        )

        store_rewards = [
            serialize_store_item(
                item,
                inventory_map.get(item.id, 0),
            )
            for item in store_items
        ]

        # -------------------------------------------------
        # ACHIEVEMENTS
        # -------------------------------------------------

        achievement_records = (
            Achievement.query
            .filter_by(active=True)
            .all()
        )

        achievements = [
            serialize_achievement(
                user,
                achievement,
            )
            for achievement in achievement_records
        ]

        # -------------------------------------------------
        # RECENT HISTORY
        # -------------------------------------------------

        transactions = (
            RewardTransaction.query
            .filter_by(user_id=user.id)
            .order_by(
                RewardTransaction.created_at.desc()
            )
            .limit(10)
            .all()
        )

        recent_rewards = [
            serialize_transaction(transaction)
            for transaction in transactions
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

                "currentStreak": user.current_streak or 0,
                "longestStreak": user.longest_streak or 0,

                "totalXpEarned": total_xp_earned or 0,

                "levelXp": current_level_xp,
                "levelXpRequired": level_requirement,
                "xpProgress": round(
                    min(progress_percentage, 100),
                    2,
                ),
            },

            "dailyChallenges": daily_challenges,
            "weeklyChallenges": weekly_challenges,

            "storeRewards": store_rewards,

            "achievements": achievements,

            "recentRewards": recent_rewards,

            "inventory": [
                serialize_inventory(item)
                for item in inventory
            ],
        })

    except Exception as e:
        db.session.rollback()

        print("Rewards GET Error:", str(e))

        return jsonify({
            "success": False,
            "message": "Unable to load rewards.",
            "error": str(e),
        }), 500


# =========================================================
# CLAIM CHALLENGE
# =========================================================

@rewards_bp.route(
    "/challenges/<int:challenge_id>/claim",
    methods=["POST"],
)
def claim_challenge(challenge_id):
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

        now = datetime.utcnow()

        if not challenge.active:
            return jsonify({
                "success": False,
                "message": "This challenge is no longer active.",
            }), 400

        if challenge.starts_at and now < challenge.starts_at:
            return jsonify({
                "success": False,
                "message": "This challenge has not started yet.",
            }), 400

        if challenge.expires_at and now >= challenge.expires_at:
            return jsonify({
                "success": False,
                "message": "This challenge has expired.",
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

            db.session.add(user_challenge)
            db.session.flush()

        if user_challenge.claimed:
            return jsonify({
                "success": False,
                "message": "Challenge already claimed.",
            }), 400

        if not user_challenge.completed:
            return jsonify({
                "success": False,
                "message": "Complete the challenge before claiming it.",
                "progress": user_challenge.progress,
                "target": challenge.target,
            }), 400

        # ---------------------------------------------
        # Give rewards
        # ---------------------------------------------

        if challenge.reward_xp:
            add_xp(
                user,
                challenge.reward_xp,
                description=f"Challenge completed: {challenge.title}",
                reference_type="CHALLENGE",
                reference_id=challenge.id,
            )

        if challenge.reward_credits:
            add_credits(
                user,
                challenge.reward_credits,
                description=f"Challenge completed: {challenge.title}",
                reference_type="CHALLENGE",
                reference_id=challenge.id,
            )

        user_challenge.claimed = True
        user_challenge.claimed_at = now

        update_weekly_daily_challenge(user)

        check_all_achievements(user)

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Challenge reward claimed successfully.",

            "rewards": {
                "xp": challenge.reward_xp,
                "credits": challenge.reward_credits,
            },

            "user": {
                "xp": user.xp,
                "level": user.level,
                "credits": user.credits,
                "currentStreak": user.current_streak,
            },
        })

    except Exception as e:
        db.session.rollback()

        print("Challenge Claim Error:", str(e))

        return jsonify({
            "success": False,
            "message": "Unable to claim challenge.",
            "error": str(e),
        }), 500


# =========================================================
# REDEEM STORE ITEM
# =========================================================

@rewards_bp.route(
    "/store/<int:item_id>/redeem",
    methods=["POST"],
)
def redeem_store_item(item_id):
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
                "message": "Reward item not found.",
            }), 404

        if not item.active:
            return jsonify({
                "success": False,
                "message": "This reward is no longer available.",
            }), 400

        if item.stock is not None and item.stock == 0:
            return jsonify({
                "success": False,
                "message": "This reward is out of stock.",
            }), 400

        if user.credits < item.price:
            return jsonify({
                "success": False,
                "message": "Not enough credits.",
                "required": item.price,
                "available": user.credits,
            }), 400

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
                acquired_at=datetime.utcnow(),
            )

            db.session.add(inventory_item)

        inventory_item.quantity += 1

        if item.stock is not None and item.stock > 0:
            item.stock -= 1

        spend_credits(
            user,
            item.price,
            description=f"Redeemed reward: {item.title}",
            reference_type="STORE",
            reference_id=item.id,
        )

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Reward redeemed successfully.",

            "item": serialize_store_item(
                item,
                inventory_item.quantity,
            ),

            "user": {
                "credits": user.credits,
                "xp": user.xp,
                "level": user.level,
            },
        })

    except Exception as e:
        db.session.rollback()

        print("Store Redeem Error:", str(e))

        return jsonify({
            "success": False,
            "message": "Unable to redeem reward.",
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
            .filter_by(user_id=user.id)
            .order_by(
                UserInventory.acquired_at.desc()
            )
            .all()
        )

        return jsonify({
            "success": True,
            "inventory": [
                serialize_inventory(item)
                for item in inventory
            ],
        })

    except Exception as e:
        print("Inventory Error:", str(e))

        return jsonify({
            "success": False,
            "message": "Unable to load inventory.",
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
            .filter_by(user_id=user.id)
            .order_by(
                RewardTransaction.created_at.desc()
            )
            .limit(50)
            .all()
        )

        return jsonify({
            "success": True,
            "history": [
                serialize_transaction(transaction)
                for transaction in transactions
            ],
        })

    except Exception as e:
        print("Reward History Error:", str(e))

        return jsonify({
            "success": False,
            "message": "Unable to load reward history.",
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

        achievements = (
            Achievement.query
            .filter_by(active=True)
            .all()
        )

        return jsonify({
            "success": True,
            "achievements": [
                serialize_achievement(
                    user,
                    achievement,
                )
                for achievement in achievements
            ],
        })

    except Exception as e:
        print("Achievements Error:", str(e))

        return jsonify({
            "success": False,
            "message": "Unable to load achievements.",
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
    """
    Development-only endpoint.

    Example:
    POST /api/rewards/debug/activity/MATCH

    POST /api/rewards/debug/activity/MATCH_WIN

    POST /api/rewards/debug/activity/TOURNAMENT

    POST /api/rewards/debug/activity/TOURNAMENT_WIN
    """

    from flask import current_app

    if not current_app.debug:
        return jsonify({
            "success": False,
            "message": "Debug endpoint disabled.",
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
                "message": "Invalid activity type.",
            }), 400

        return jsonify({
            "success": True,
            "message": f"{action.upper()} activity processed.",

            "user": {
                "xp": user.xp,
                "level": user.level,
                "credits": user.credits,
                "currentStreak": user.current_streak,
                "longestStreak": user.longest_streak,
            },
        })

    except Exception as e:
        db.session.rollback()

        print("Debug Activity Error:", str(e))

        return jsonify({
            "success": False,
            "message": "Unable to process activity.",
            "error": str(e),
        }), 500