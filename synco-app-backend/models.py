from datetime import datetime
import secrets

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event


# =========================================================
# DATABASE
# =========================================================

db = SQLAlchemy()


# =========================================================
# SYNCO UID GENERATOR
# =========================================================

# Uppercase letters + numbers
#
# Excluded:
# O -> can look like 0
# 0 -> can look like O
# I -> can look like 1
# 1 -> can look like I
#
# Every UID will contain exactly 10 characters.

SYNCO_UID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_synco_uid():
    """
    Generate a unique 10-character SYNCO UID.

    Example:
        A7K29X4P9Q
        B8M52Z7KQC
        X4R9T6P2WA
    """

    while True:

        uid = "".join(
            secrets.choice(SYNCO_UID_CHARS)
            for _ in range(10)
        )

        # Check uniqueness
        if not User.query.filter_by(uid=uid).first():
            return uid


# =========================================================
# DISCORD AVATAR HELPER
# =========================================================

def discord_avatar_url(user_id, avatar):

    if not user_id or not avatar:
        return None

    if avatar.startswith("http"):
        return avatar

    return (
        f"https://cdn.discordapp.com/avatars/"
        f"{user_id}/{avatar}.png?size=256"
    )


# =========================================================
# USER
# =========================================================

class User(db.Model):

    __tablename__ = "users"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    # -----------------------------------------------------
    # Basic information
    # -----------------------------------------------------

    name = db.Column(
        db.String(100),
        nullable=False
    )

    email = db.Column(
        db.String(255),
        unique=True,
        nullable=False,
        index=True
    )

    # -----------------------------------------------------
    # Authentication
    # -----------------------------------------------------

    password_hash = db.Column(
        db.String(255),
        nullable=True
    )

    google_id = db.Column(
        db.String(255),
        unique=True,
        nullable=True
    )

    discord_id = db.Column(
        db.String(255),
        unique=True,
        nullable=True
    )

    # -----------------------------------------------------
    # Profile
    # -----------------------------------------------------

    username = db.Column(
        db.String(50),
        unique=True,
        nullable=True,
        index=True
    )

    # -----------------------------------------------------
    # SYNCO UID
    # -----------------------------------------------------

    uid = db.Column(
        db.String(10),
        unique=True,
        nullable=False,
        index=True
    )

    avatar = db.Column(
        db.Text,
        nullable=True
    )

    # -----------------------------------------------------
    # Verification
    # -----------------------------------------------------

    email_verified = db.Column(
        db.Boolean,
        default=False,
        nullable=False
    )

    discord_verified = db.Column(
        db.Boolean,
        default=False,
        nullable=False
    )

    # =====================================================
    # SYNCO REWARDS
    # =====================================================

    xp = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    level = db.Column(
        db.Integer,
        nullable=False,
        default=1
    )

    credits = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    current_streak = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    longest_streak = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    last_activity_at = db.Column(
        db.DateTime,
        nullable=True
    )

    # -----------------------------------------------------
    # Timestamps
    # -----------------------------------------------------

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    # -----------------------------------------------------
    # Rewards relationships
    # -----------------------------------------------------

    reward_challenges = db.relationship(
        "UserChallenge",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    inventory = db.relationship(
        "UserInventory",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    achievements = db.relationship(
        "UserAchievement",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    reward_transactions = db.relationship(
        "RewardTransaction",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    # -----------------------------------------------------
    # Serialization
    # -----------------------------------------------------

    def to_dict(self):

        resolved_avatar = self.avatar

        if (
            self.discord_id
            and self.avatar
            and not self.avatar.startswith("http")
        ):
            resolved_avatar = discord_avatar_url(
                self.discord_id,
                self.avatar
            )

        return {
            "id": self.id,

            # SYNCO public identity
            "uid": self.uid,

            "name": self.name,
            "email": self.email,
            "username": self.username,

            "google_linked": bool(self.google_id),
            "discord_linked": bool(self.discord_id),

            "avatar": resolved_avatar,

            "email_verified": self.email_verified,
            "discord_verified": self.discord_verified,

            # Rewards
            "xp": self.xp,
            "level": self.level,
            "credits": self.credits,
            "current_streak": self.current_streak,
            "longest_streak": self.longest_streak,

            "created_at": (
                self.created_at.isoformat()
                if self.created_at
                else None
            )
        }


# =========================================================
# AUTOMATIC SYNCO UID
# =========================================================

@event.listens_for(User, "before_insert")
def assign_synco_uid(mapper, connection, target):

    # Only generate if UID was not manually provided.
    if not target.uid:

        target.uid = generate_synco_uid()


# =========================================================
# USER PROFILE
# =========================================================

class UserProfile(db.Model):

    __tablename__ = "user_profiles"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        unique=True,
        nullable=False
    )

    basic_data = db.Column(
        db.JSON,
        nullable=False,
        default=dict
    )

    socials = db.Column(
        db.JSON,
        nullable=False,
        default=dict
    )


# =========================================================
# PROFILE GAMES
# =========================================================

class ProfileGame(db.Model):

    __tablename__ = "profile_games"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    game_name = db.Column(
        db.String(100),
        nullable=False
    )

    ign = db.Column(
        db.String(100),
        nullable=False
    )

    uid = db.Column(
        db.String(100),
        nullable=False
    )

    role = db.Column(
        db.String(100),
        nullable=False,
        default=""
    )

    tier = db.Column(
        db.String(100),
        nullable=False,
        default="Semi-Pro"
    )

    experience = db.Column(
        db.String(100),
        nullable=False,
        default=""
    )

    def to_dict(self):

        return {
            "id": self.id,
            "gameName": self.game_name,
            "ign": self.ign,
            "uid": self.uid,
            "role": self.role,
            "tier": self.tier,
            "experience": self.experience,
        }


# =========================================================
# GAMES
# =========================================================

class Game(db.Model):

    __tablename__ = "games"

    id = db.Column(
        db.String(50),
        primary_key=True
    )

    name = db.Column(
        db.String(100),
        nullable=False
    )

    short_name = db.Column(
        db.String(100),
        nullable=False
    )

    slug = db.Column(
        db.String(100),
        unique=True,
        nullable=True,
        index=True
    )

    description = db.Column(
        db.Text,
        nullable=True
    )

    logo_url = db.Column(
        db.Text,
        nullable=True
    )

    is_active = db.Column(
        db.Boolean,
        nullable=False,
        default=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    def to_dict(self):

        return {
            "id": self.id,
            "name": self.name,
            "shortName": self.short_name,
            "slug": self.slug,
            "description": self.description,
            "logoUrl": self.logo_url,
            "isActive": self.is_active,
        }


# =========================================================
# PLAYER GAME STATS
# =========================================================
#
# Competitive SYNCO Points are stored separately from XP.
#
# XP:
#   Rewards / progression
#
# SYNCO Points:
#   Competitive ranking
#
# One player can have different SYNCO Points for every game.
#
# Example:
#
# Hardik
#   BGMI       -> 1500
#   VALORANT   -> 820
#   CS2        -> 430
#
# =========================================================

class PlayerGameStats(db.Model):

    __tablename__ = "player_game_stats"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    game_id = db.Column(
        db.String(50),
        db.ForeignKey("games.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    synco_points = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    # -----------------------------------------------------
    # Relationships
    # -----------------------------------------------------

    user = db.relationship(
        "User",
        backref=db.backref(
            "game_stats",
            lazy=True,
            cascade="all, delete-orphan"
        )
    )

    game = db.relationship(
        "Game",
        backref=db.backref(
            "player_stats",
            lazy=True
        )
    )

    # -----------------------------------------------------
    # One record per player + game
    # -----------------------------------------------------

    __table_args__ = (
        db.UniqueConstraint(
            "user_id",
            "game_id",
            name="uq_player_game_stats_user_game"
        ),
    )

    # -----------------------------------------------------
    # Serialization
    # -----------------------------------------------------

    def to_dict(self):

        return {
            "id": self.id,
            "userId": self.user_id,
            "gameId": self.game_id,
            "syncoPoints": self.synco_points,

            "createdAt": (
                self.created_at.isoformat()
                if self.created_at
                else None
            ),

            "updatedAt": (
                self.updated_at.isoformat()
                if self.updated_at
                else None
            )
        }


# =========================================================
# PROFILE CLIPS
# =========================================================

class ProfileClip(db.Model):

    __tablename__ = "profile_clips"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    title = db.Column(
        db.String(160),
        nullable=False
    )

    filename = db.Column(
        db.String(255),
        nullable=False,
        unique=True
    )

    duration_seconds = db.Column(
        db.Float,
        nullable=False
    )

    width = db.Column(
        db.Integer,
        nullable=False
    )

    height = db.Column(
        db.Integer,
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    likes = db.relationship(
        "ProfileClipLike",
        cascade="all, delete-orphan",
        lazy="select"
    )

    comments = db.relationship(
        "ProfileClipComment",
        cascade="all, delete-orphan",
        lazy="select"
    )

    def to_dict(self, media_url):

        return {
            "id": self.id,
            "title": self.title,
            "url": media_url,
            "durationSeconds": self.duration_seconds,
            "width": self.width,
            "height": self.height,
            "likes": len(self.likes),
            "comments": len(self.comments),
        }


# =========================================================
# PROFILE CLIP LIKES
# =========================================================

class ProfileClipLike(db.Model):

    __tablename__ = "profile_clip_likes"

    __table_args__ = (
        db.UniqueConstraint(
            "clip_id",
            "user_id",
            name="uq_profile_clip_like"
        ),
    )

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    clip_id = db.Column(
        db.Integer,
        db.ForeignKey("profile_clips.id"),
        nullable=False,
        index=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )


# =========================================================
# PROFILE CLIP COMMENTS
# =========================================================

class ProfileClipComment(db.Model):

    __tablename__ = "profile_clip_comments"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    clip_id = db.Column(
        db.Integer,
        db.ForeignKey("profile_clips.id"),
        nullable=False,
        index=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    content = db.Column(
        db.String(1000),
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    user = db.relationship(
        "User",
        lazy="joined"
    )

    def to_dict(self):

        return {
            "id": self.id,
            "content": self.content,
            "author": (
                self.user.username
                or self.user.name
            ),
            "avatarUrl": self.user.avatar or "",
            "createdAt": (
                self.created_at.isoformat()
                if self.created_at
                else None
            ),
        }


# =========================================================
# REWARDS
# =========================================================

class RewardChallenge(db.Model):

    __tablename__ = "reward_challenges"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    title = db.Column(
        db.String(160),
        nullable=False
    )

    description = db.Column(
        db.String(500),
        nullable=False,
        default=""
    )

    challenge_type = db.Column(
        db.String(50),
        nullable=False
    )

    target = db.Column(
        db.Integer,
        nullable=False
    )

    reward_xp = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    reward_credits = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    period = db.Column(
        db.String(20),
        nullable=False
    )

    icon = db.Column(
        db.String(50),
        nullable=False,
        default="Target"
    )

    active = db.Column(
        db.Boolean,
        nullable=False,
        default=True
    )

    starts_at = db.Column(
        db.DateTime,
        nullable=True
    )

    expires_at = db.Column(
        db.DateTime,
        nullable=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    user_progress = db.relationship(
        "UserChallenge",
        back_populates="challenge",
        cascade="all, delete-orphan"
    )

    def to_dict(self):

        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "challengeType": self.challenge_type,
            "target": self.target,
            "rewardXp": self.reward_xp,
            "rewardCredits": self.reward_credits,
            "period": self.period,
            "icon": self.icon,
            "active": self.active,

            "startsAt": (
                self.starts_at.isoformat()
                if self.starts_at
                else None
            ),

            "expiresAt": (
                self.expires_at.isoformat()
                if self.expires_at
                else None
            ),
        }


class UserChallenge(db.Model):

    __tablename__ = "user_challenges"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    challenge_id = db.Column(
        db.Integer,
        db.ForeignKey("reward_challenges.id"),
        nullable=False,
        index=True
    )

    progress = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    completed = db.Column(
        db.Boolean,
        nullable=False,
        default=False
    )

    claimed = db.Column(
        db.Boolean,
        nullable=False,
        default=False
    )

    started_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    completed_at = db.Column(
        db.DateTime,
        nullable=True
    )

    claimed_at = db.Column(
        db.DateTime,
        nullable=True
    )

    user = db.relationship(
        "User",
        back_populates="reward_challenges"
    )

    challenge = db.relationship(
        "RewardChallenge",
        back_populates="user_progress"
    )

    __table_args__ = (
        db.UniqueConstraint(
            "user_id",
            "challenge_id",
            name="uq_user_reward_challenge"
        ),
    )

    def to_dict(self):

        return {
            "id": self.id,
            "challengeId": self.challenge_id,
            "title": self.challenge.title,
            "description": self.challenge.description,
            "challengeType": self.challenge.challenge_type,
            "target": self.challenge.target,
            "progress": self.progress,
            "completed": self.completed,
            "claimed": self.claimed,
            "rewardXp": self.challenge.reward_xp,
            "rewardCredits": self.challenge.reward_credits,
            "period": self.challenge.period,
            "icon": self.challenge.icon,
        }


class RewardItem(db.Model):

    __tablename__ = "reward_items"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    title = db.Column(
        db.String(160),
        nullable=False
    )

    description = db.Column(
        db.String(500),
        nullable=False,
        default=""
    )

    price = db.Column(
        db.Integer,
        nullable=False
    )

    item_type = db.Column(
        db.String(50),
        nullable=False
    )

    icon = db.Column(
        db.String(50),
        nullable=False,
        default="Award"
    )

    active = db.Column(
        db.Boolean,
        nullable=False,
        default=True
    )

    stock = db.Column(
        db.Integer,
        nullable=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    inventory = db.relationship(
        "UserInventory",
        back_populates="reward_item",
        cascade="all, delete-orphan"
    )

    def to_dict(self):

        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "price": self.price,
            "type": self.item_type,
            "icon": self.icon,
            "active": self.active,
            "stock": self.stock,
        }


class UserInventory(db.Model):

    __tablename__ = "user_inventory"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    reward_item_id = db.Column(
        db.Integer,
        db.ForeignKey("reward_items.id"),
        nullable=False,
        index=True
    )

    quantity = db.Column(
        db.Integer,
        nullable=False,
        default=1
    )

    acquired_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    user = db.relationship(
        "User",
        back_populates="inventory"
    )

    reward_item = db.relationship(
        "RewardItem",
        back_populates="inventory"
    )

    __table_args__ = (
        db.UniqueConstraint(
            "user_id",
            "reward_item_id",
            name="uq_user_reward_item"
        ),
    )

    def to_dict(self):

        return {
            "id": self.id,
            "quantity": self.quantity,
            "acquiredAt": self.acquired_at.isoformat(),
            "item": self.reward_item.to_dict(),
        }


class Achievement(db.Model):

    __tablename__ = "achievements"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    title = db.Column(
        db.String(160),
        nullable=False
    )

    description = db.Column(
        db.String(500),
        nullable=False
    )

    requirement_type = db.Column(
        db.String(50),
        nullable=False
    )

    requirement_value = db.Column(
        db.Integer,
        nullable=False,
        default=1
    )

    reward_xp = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    reward_credits = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    icon = db.Column(
        db.String(50),
        nullable=False,
        default="Award"
    )

    active = db.Column(
        db.Boolean,
        nullable=False,
        default=True
    )

    user_achievements = db.relationship(
        "UserAchievement",
        back_populates="achievement",
        cascade="all, delete-orphan"
    )

    def to_dict(self):

        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "requirementType": self.requirement_type,
            "requirementValue": self.requirement_value,
            "rewardXp": self.reward_xp,
            "rewardCredits": self.reward_credits,
            "icon": self.icon,
            "active": self.active,
        }


class UserAchievement(db.Model):

    __tablename__ = "user_achievements"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    achievement_id = db.Column(
        db.Integer,
        db.ForeignKey("achievements.id"),
        nullable=False,
        index=True
    )

    unlocked_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    user = db.relationship(
        "User",
        back_populates="achievements"
    )

    achievement = db.relationship(
        "Achievement",
        back_populates="user_achievements"
    )

    __table_args__ = (
        db.UniqueConstraint(
            "user_id",
            "achievement_id",
            name="uq_user_achievement"
        ),
    )

    def to_dict(self):

        data = self.achievement.to_dict()

        data.update({
            "id": self.achievement.id,
            "unlocked": True,
            "unlockedAt": self.unlocked_at.isoformat(),
        })

        return data


class RewardTransaction(db.Model):

    __tablename__ = "reward_transactions"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    transaction_type = db.Column(
        db.String(50),
        nullable=False
    )

    xp_amount = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    credits_amount = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    description = db.Column(
        db.String(255),
        nullable=False
    )

    reference_type = db.Column(
        db.String(50),
        nullable=True
    )

    reference_id = db.Column(
        db.Integer,
        nullable=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True
    )

    user = db.relationship(
        "User",
        back_populates="reward_transactions"
    )

    def to_dict(self):

        return {
            "id": self.id,
            "type": self.transaction_type,
            "xpAmount": self.xp_amount,
            "creditsAmount": self.credits_amount,
            "description": self.description,
            "referenceType": self.reference_type,
            "referenceId": self.reference_id,
            "createdAt": self.created_at.isoformat(),
        }


# =========================================================
# CLUB
# =========================================================

class Club(db.Model):

    __tablename__ = "clubs"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    name = db.Column(
        db.String(100),
        nullable=False,
        unique=True,
        index=True
    )

    tag = db.Column(
        db.String(5),
        nullable=False,
        unique=True,
        index=True
    )

    description = db.Column(
        db.Text,
        nullable=True
    )

    privacy = db.Column(
        db.String(20),
        nullable=False,
        default="Public"
    )

    game_id = db.Column(
        db.String(50),
        db.ForeignKey("games.id"),
        nullable=False
    )

    owner_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    # =====================================================
    # CLUB RANKING
    # =====================================================

    avatar = db.Column(
        db.Text,
        nullable=True
    )

    region = db.Column(
        db.String(100),
        nullable=False,
        default="Global"
    )

    club_level = db.Column(
        db.Integer,
        nullable=False,
        default=1
    )

    synco_points = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    # -----------------------------------------------------
    # Status
    # -----------------------------------------------------

    is_active = db.Column(
        db.Boolean,
        nullable=False,
        default=True
    )

    # -----------------------------------------------------
    # Timestamps
    # -----------------------------------------------------

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    # -----------------------------------------------------
    # Relationships
    # -----------------------------------------------------

    game = db.relationship(
        "Game",
        backref=db.backref(
            "clubs",
            lazy=True
        )
    )

    owner = db.relationship(
        "User",
        foreign_keys=[owner_id],
        backref=db.backref(
            "owned_clubs",
            lazy=True
        )
    )

    members = db.relationship(
        "ClubMember",
        back_populates="club",
        cascade="all, delete-orphan",
        lazy=True
    )

    invites = db.relationship(
        "ClubInvite",
        back_populates="club",
        cascade="all, delete-orphan",
        lazy=True
    )

    # -----------------------------------------------------
    # Serialization
    # -----------------------------------------------------

    def to_dict(self):

        return {
            "id": self.id,

            "name": self.name,
            "tag": self.tag,
            "description": self.description,
            "privacy": self.privacy,

            "gameId": self.game_id,

            "game": (
                self.game.to_dict()
                if self.game
                else None
            ),

            "ownerId": self.owner_id,

            "owner": (
                self.owner.to_dict()
                if self.owner
                else None
            ),

            # Club ranking
            "avatar": self.avatar,
            "region": self.region,
            "clubLevel": self.club_level,
            "syncoPoints": self.synco_points,

            "isActive": self.is_active,

            "memberCount": len(self.members),

            "createdAt": (
                self.created_at.isoformat()
                if self.created_at
                else None
            ),

            "updatedAt": (
                self.updated_at.isoformat()
                if self.updated_at
                else None
            )
        }


# =========================================================
# CLUB MEMBER
# =========================================================

class ClubMember(db.Model):

    __tablename__ = "club_members"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    club_id = db.Column(
        db.Integer,
        db.ForeignKey("clubs.id"),
        nullable=False
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    role = db.Column(
        db.String(20),
        nullable=False,
        default="MEMBER"
    )

    joined_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    club = db.relationship(
        "Club",
        back_populates="members"
    )

    user = db.relationship(
        "User",
        backref=db.backref(
            "club_memberships",
            lazy=True
        )
    )

    __table_args__ = (
        db.UniqueConstraint(
            "club_id",
            "user_id",
            name="unique_club_member"
        ),
    )

    def to_dict(self):

        return {
            "id": self.id,
            "clubId": self.club_id,
            "userId": self.user_id,
            "role": self.role,

            "joinedAt": (
                self.joined_at.isoformat()
                if self.joined_at
                else None
            ),

            "user": (
                self.user.to_dict()
                if self.user
                else None
            )
        }


# =========================================================
# CLUB INVITE
# =========================================================

class ClubInvite(db.Model):

    __tablename__ = "club_invites"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    club_id = db.Column(
        db.Integer,
        db.ForeignKey("clubs.id"),
        nullable=False,
        index=True
    )

    inviter_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    invitee_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    status = db.Column(
        db.String(20),
        nullable=False,
        default="PENDING"
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    responded_at = db.Column(
        db.DateTime,
        nullable=True
    )

    club = db.relationship(
        "Club",
        back_populates="invites"
    )

    inviter = db.relationship(
        "User",
        foreign_keys=[inviter_id],
        backref=db.backref(
            "sent_club_invites",
            lazy=True
        )
    )

    invitee = db.relationship(
        "User",
        foreign_keys=[invitee_id],
        backref=db.backref(
            "received_club_invites",
            lazy=True
        )
    )

    __table_args__ = (
        db.UniqueConstraint(
            "club_id",
            "invitee_id",
            "status",
            name="unique_pending_club_invite"
        ),
    )

    def to_dict(self):

        return {
            "id": self.id,

            "club": (
                self.club.to_dict()
                if self.club
                else None
            ),

            "inviter": (
                self.inviter.to_dict()
                if self.inviter
                else None
            ),

            "invitee": (
                self.invitee.to_dict()
                if self.invitee
                else None
            ),

            "status": self.status,

            "createdAt": (
                self.created_at.isoformat()
                if self.created_at
                else None
            ),

            "respondedAt": (
                self.responded_at.isoformat()
                if self.responded_at
                else None
            )
        }


# =========================================================
# NOTIFICATION
# =========================================================

class Notification(db.Model):

    __tablename__ = "notifications"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    # -----------------------------------------------------
    # Receiver
    # -----------------------------------------------------

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    # -----------------------------------------------------
    # Notification type
    # -----------------------------------------------------

    notification_type = db.Column(
        db.String(50),
        nullable=False,
        index=True
    )

    # -----------------------------------------------------
    # Content
    # -----------------------------------------------------

    title = db.Column(
        db.String(200),
        nullable=False
    )

    message = db.Column(
        db.String(500),
        nullable=False
    )

    # -----------------------------------------------------
    # Optional related object
    # -----------------------------------------------------

    reference_type = db.Column(
        db.String(50),
        nullable=True
    )

    reference_id = db.Column(
        db.Integer,
        nullable=True,
        index=True
    )

    # -----------------------------------------------------
    # Extra data
    # -----------------------------------------------------

    data = db.Column(
        db.JSON,
        nullable=False,
        default=dict
    )

    # -----------------------------------------------------
    # Read state
    # -----------------------------------------------------

    is_read = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
        index=True
    )

    # -----------------------------------------------------
    # Timestamp
    # -----------------------------------------------------

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True
    )

    # -----------------------------------------------------
    # Relationship
    # -----------------------------------------------------

    user = db.relationship(
        "User",
        backref=db.backref(
            "notifications",
            lazy=True,
            cascade="all, delete-orphan"
        )
    )

    # -----------------------------------------------------
    # Serialization
    # -----------------------------------------------------

    def to_dict(self):

        return {
            "id": self.id,

            "type": self.notification_type,

            "title": self.title,

            "message": self.message,

            "referenceType": self.reference_type,

            "referenceId": self.reference_id,

            "data": self.data or {},

            "isRead": self.is_read,

            "createdAt": (
                self.created_at.isoformat()
                if self.created_at
                else None
            )
        }


# =========================================================
# FRIEND REQUEST
# =========================================================

class FriendRequest(db.Model):

    __tablename__ = "friend_requests"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    # -----------------------------------------------------
    # Sender
    # -----------------------------------------------------

    sender_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    # -----------------------------------------------------
    # Receiver
    # -----------------------------------------------------

    receiver_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    # -----------------------------------------------------
    # Status
    # -----------------------------------------------------

    status = db.Column(
        db.String(20),
        nullable=False,
        default="PENDING",
        index=True
    )

    # -----------------------------------------------------
    # Timestamps
    # -----------------------------------------------------

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    responded_at = db.Column(
        db.DateTime,
        nullable=True
    )

    # -----------------------------------------------------
    # Relationships
    # -----------------------------------------------------

    sender = db.relationship(
        "User",
        foreign_keys=[sender_id],
        backref=db.backref(
            "sent_friend_requests",
            lazy=True
        )
    )

    receiver = db.relationship(
        "User",
        foreign_keys=[receiver_id],
        backref=db.backref(
            "received_friend_requests",
            lazy=True
        )
    )

    # -----------------------------------------------------
    # Constraints
    # -----------------------------------------------------

    __table_args__ = (
        db.UniqueConstraint(
            "sender_id",
            "receiver_id",
            "status",
            name="unique_friend_request_status"
        ),
    )

    # -----------------------------------------------------
    # Serialization
    # -----------------------------------------------------

    def to_dict(self):

        return {
            "id": self.id,

            "status": self.status,

            "createdAt": (
                self.created_at.isoformat()
                if self.created_at
                else None
            ),

            "respondedAt": (
                self.responded_at.isoformat()
                if self.responded_at
                else None
            ),

            "sender": (
                {
                    "id": self.sender.id,
                    "uid": self.sender.uid,
                    "username": self.sender.username,
                    "name": self.sender.name,
                    "avatar": self.sender.avatar,
                }
                if self.sender
                else None
            ),

            "receiver": (
                {
                    "id": self.receiver.id,
                    "uid": self.receiver.uid,
                    "username": self.receiver.username,
                    "name": self.receiver.name,
                    "avatar": self.receiver.avatar,
                }
                if self.receiver
                else None
            )
        }


# =========================================================
# FRIENDSHIP
# =========================================================

class Friendship(db.Model):

    __tablename__ = "friendships"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    friend_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    user = db.relationship(
        "User",
        foreign_keys=[user_id],
        backref=db.backref(
            "friendships",
            lazy=True
        )
    )

    friend = db.relationship(
        "User",
        foreign_keys=[friend_id]
    )

    __table_args__ = (
        db.UniqueConstraint(
            "user_id",
            "friend_id",
            name="unique_friendship"
        ),
    )

    def to_dict(self):

        return {
            "id": self.id,

            "friend": (
                {
                    "id": self.friend.id,
                    "uid": self.friend.uid,
                    "username": self.friend.username,
                    "name": self.friend.name,
                    "avatar": self.friend.avatar,
                    "level": self.friend.level,
                }
                if self.friend
                else None
            ),

            "createdAt": (
                self.created_at.isoformat()
                if self.created_at
                else None
            )
        }