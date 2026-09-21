from datetime import datetime
import secrets

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event, text


# =========================================================
# DATABASE
# =========================================================

db = SQLAlchemy()


# =========================================================
# SYNCO UID GENERATOR
# =========================================================

SYNCO_UID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_synco_uid():
    """
    Generate a unique 10-character SYNCO UID.
    """

    while True:
        uid = "".join(
            secrets.choice(SYNCO_UID_CHARS)
            for _ in range(10)
        )

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

    # -----------------------------------------------------
    # ACCOUNT ROLE
    # -----------------------------------------------------

    # Platform-level authorization role.
    # Keep this separate from ProfileGame.role, which stores
    # a player's role for a specific game.
    account_role = db.Column(
        db.String(30),
        nullable=False,
        default="player",
        index=True
    )

    # -----------------------------------------------------
    # ACCOUNT STATUS
    # -----------------------------------------------------
    # Platform account lifecycle. This is intentionally
    # separate from account_role.
    #
    # active    -> normal access
    # suspended -> login/API access blocked
    account_status = db.Column(
        db.String(20),
        nullable=False,
        default="active",
        index=True
    )

    account_status_reason = db.Column(
        db.Text,
        nullable=True
    )

    account_status_changed_at = db.Column(
        db.DateTime,
        nullable=True
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
            "uid": self.uid,
            "name": self.name,
            "email": self.email,
            "username": self.username,

            "google_linked": bool(self.google_id),
            "discord_linked": bool(self.discord_id),

            "avatar": resolved_avatar,

            "email_verified": self.email_verified,
            "discord_verified": self.discord_verified,

            "account_role": self.account_role,
            "account_status": self.account_status,
            "account_status_reason": self.account_status_reason,
            "account_status_changed_at": (
                self.account_status_changed_at.isoformat()
                if self.account_status_changed_at
                else None
            ),

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

    if not target.uid:
        target.uid = generate_synco_uid()


# =========================================================
# ADMIN USER ACTION AUDIT LOG
# =========================================================

class AdminUserActionLog(db.Model):

    __tablename__ = "admin_user_action_logs"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    admin_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    target_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Snapshot values are preserved even after a hard delete.
    target_uid = db.Column(
        db.String(10),
        nullable=True,
        index=True
    )

    target_email = db.Column(
        db.String(255),
        nullable=True
    )

    action = db.Column(
        db.String(50),
        nullable=False,
        index=True
    )

    reason = db.Column(
        db.Text,
        nullable=True
    )

    audit_metadata = db.Column(
        "metadata",
        db.JSON,
        nullable=False,
        default=dict
    )

    ip_address = db.Column(
        db.String(64),
        nullable=True
    )

    user_agent = db.Column(
        db.Text,
        nullable=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True
    )

    admin = db.relationship(
        "User",
        foreign_keys=[admin_id]
    )

    target_user = db.relationship(
        "User",
        foreign_keys=[target_user_id]
    )

    def to_dict(self):

        return {
            "id": self.id,
            "adminId": self.admin_id,
            "targetUserId": self.target_user_id,
            "targetUid": self.target_uid,
            "targetEmail": self.target_email,
            "action": self.action,
            "reason": self.reason,
            "metadata": self.audit_metadata or {},
            "ipAddress": self.ip_address,
            "userAgent": self.user_agent,
            "createdAt": (
                self.created_at.isoformat()
                if self.created_at
                else None
            )
        }


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

    __table_args__ = (
        db.UniqueConstraint(
            "user_id",
            "game_id",
            name="uq_player_game_stats_user_game"
        ),
    )

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
        db.String(500),
        nullable=False,
        unique=True,
        index=True
    )

    file_size = db.Column(
        db.BigInteger,
        nullable=False,
        default=0
    )

    mime_type = db.Column(
        db.String(100),
        nullable=False,
        default="video/mp4"
    )

    duration_seconds = db.Column(
        db.Float,
        nullable=False,
        default=0
    )

    width = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    height = db.Column(
        db.Integer,
        nullable=False,
        default=0
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
            "filename": self.filename,
            "fileSize": self.file_size,
            "mimeType": self.mime_type,
            "durationSeconds": self.duration_seconds,
            "width": self.width,
            "height": self.height,
            "likes": len(self.likes),
            "comments": len(self.comments),

            "createdAt": (
                self.created_at.isoformat()
                if self.created_at
                else None
            ),
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

            "avatarUrl": (
                self.user.avatar
                or ""
            ),

            "createdAt": (
                self.created_at.isoformat()
                if self.created_at
                else None
            ),
        }


# =========================================================
# REWARD CHALLENGE
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


# =========================================================
# USER CHALLENGE
# =========================================================

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


# =========================================================
# REWARD ITEM
# =========================================================

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


# =========================================================
# USER INVENTORY
# =========================================================

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

            "acquiredAt": (
                self.acquired_at.isoformat()
                if self.acquired_at
                else None
            ),

            "item": self.reward_item.to_dict(),
        }


# =========================================================
# ACHIEVEMENT
# =========================================================

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


# =========================================================
# USER ACHIEVEMENT
# =========================================================

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


# =========================================================
# REWARD TRANSACTION
# =========================================================

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

            "createdAt": (
                self.created_at.isoformat()
                if self.created_at
                else None
            ),
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
    # CLUB VISUALS
    # =====================================================

    avatar = db.Column(
        db.Text,
        nullable=True
    )

    banner = db.Column(
        db.Text,
        nullable=True
    )

    # =====================================================
    # CLUB SETTINGS
    # =====================================================

    allow_member_invites = db.Column(
        db.Boolean,
        nullable=False,
        default=True
    )

    require_join_approval = db.Column(
        db.Boolean,
        nullable=False,
        default=True
    )

    # =====================================================
    # CLUB RANKING
    # =====================================================

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

    # =====================================================
    # COMPATIBILITY ALIAS
    # =====================================================

    @property
    def level(self):
        return self.club_level

    @level.setter
    def level(self, value):
        self.club_level = value

    # =====================================================
    # STATUS
    # =====================================================

    is_active = db.Column(
        db.Boolean,
        nullable=False,
        default=True
    )

    # =====================================================
    # TIMESTAMPS
    # =====================================================

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

    # =====================================================
    # RELATIONSHIPS
    # =====================================================

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

    join_requests = db.relationship(
        "ClubJoinRequest",
        back_populates="club",
        cascade="all, delete-orphan",
        lazy=True
    )

    recruitment_posts = db.relationship(
        "ClubRecruitmentPost",
        back_populates="club",
        cascade="all, delete-orphan",
        lazy=True
    )

    # =====================================================
    # SERIALIZATION
    # =====================================================

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

            "avatar": self.avatar,
            "banner": self.banner,

            "region": self.region,

            "clubLevel": self.club_level,
            "level": self.club_level,
            "syncoPoints": self.synco_points,

            "allowMemberInvites": self.allow_member_invites,
            "requireJoinApproval": self.require_join_approval,

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
# CLUB JOIN REQUEST
# =========================================================

class ClubJoinRequest(db.Model):

    __tablename__ = "club_join_requests"

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

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    status = db.Column(
        db.String(20),
        nullable=False,
        default="PENDING",
        index=True
    )

    message = db.Column(
        db.String(500),
        nullable=True
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

    responded_by = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=True
    )

    club = db.relationship(
        "Club",
        back_populates="join_requests"
    )

    user = db.relationship(
        "User",
        foreign_keys=[user_id],
        backref=db.backref(
            "club_join_requests",
            lazy=True
        )
    )

    responder = db.relationship(
        "User",
        foreign_keys=[responded_by],
        backref=db.backref(
            "club_join_request_decisions",
            lazy=True
        )
    )

    __table_args__ = (
        db.UniqueConstraint(
            "club_id",
            "user_id",
            "status",
            name="unique_club_join_request_status"
        ),
    )

    def to_dict(self):

        return {
            "id": self.id,
            "clubId": self.club_id,
            "userId": self.user_id,

            "status": self.status,
            "message": self.message,

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

            "respondedBy": (
                self.responded_by
                if self.responded_by
                else None
            ),

            "user": (
                self.user.to_dict()
                if self.user
                else None
            ),

            "club": (
                self.club.to_dict()
                if self.club
                else None
            )
        }


# =========================================================
# CLUB RECRUITMENT POST
# =========================================================

class ClubRecruitmentPost(db.Model):

    __tablename__ = "club_recruitment_posts"

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

    created_by = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    title = db.Column(
        db.String(160),
        nullable=False
    )

    description = db.Column(
        db.String(2000),
        nullable=False
    )

    game_id = db.Column(
        db.String(50),
        db.ForeignKey("games.id"),
        nullable=False,
        index=True
    )

    role = db.Column(
        db.String(100),
        nullable=True
    )

    rank_requirement = db.Column(
        db.String(100),
        nullable=True
    )

    region = db.Column(
        db.String(100),
        nullable=True
    )

    mic_required = db.Column(
        db.Boolean,
        nullable=False,
        default=False
    )

    status = db.Column(
        db.String(20),
        nullable=False,
        default="OPEN",
        index=True
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

    club = db.relationship(
        "Club",
        back_populates="recruitment_posts"
    )

    creator = db.relationship(
        "User",
        foreign_keys=[created_by],
        backref=db.backref(
            "created_recruitment_posts",
            lazy=True
        )
    )

    game = db.relationship(
        "Game",
        foreign_keys=[game_id]
    )

    def to_dict(self):

        return {
            "id": self.id,
            "clubId": self.club_id,
            "createdBy": self.created_by,

            "title": self.title,
            "description": self.description,

            "gameId": self.game_id,

            "game": (
                self.game.to_dict()
                if self.game
                else None
            ),

            "role": self.role,
            "rankRequirement": self.rank_requirement,
            "region": self.region,
            "micRequired": self.mic_required,

            "status": self.status,

            "createdAt": (
                self.created_at.isoformat()
                if self.created_at
                else None
            ),

            "updatedAt": (
                self.updated_at.isoformat()
                if self.updated_at
                else None
            ),

            "creator": (
                {
                    "id": self.creator.id,
                    "uid": self.creator.uid,
                    "username": self.creator.username,
                    "name": self.creator.name,
                    "avatar": self.creator.avatar,
                }
                if self.creator
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

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    notification_type = db.Column(
        db.String(50),
        nullable=False,
        index=True
    )

    title = db.Column(
        db.String(200),
        nullable=False
    )

    message = db.Column(
        db.String(500),
        nullable=False
    )

    reference_type = db.Column(
        db.String(50),
        nullable=True
    )

    reference_id = db.Column(
        db.Integer,
        nullable=True,
        index=True
    )

    data = db.Column(
        db.JSON,
        nullable=False,
        default=dict
    )

    is_read = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
        index=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True
    )

    user = db.relationship(
        "User",
        backref=db.backref(
            "notifications",
            lazy=True,
            cascade="all, delete-orphan"
        )
    )

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

    sender_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    receiver_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    status = db.Column(
        db.String(20),
        nullable=False,
        default="PENDING",
        index=True
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

    __table_args__ = (
        db.UniqueConstraint(
            "sender_id",
            "receiver_id",
            "status",
            name="unique_friend_request_status"
        ),
    )

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
# =========================================================
# SYNCO COMPETITION ENGINE
# =========================================================
#
# Competition architecture:
#
# Game
#   ↓
# Competition
#   ↓
# CompetitionStage
#   ↓
# CompetitionMatch
#   ↓
# MatchSide / MatchParticipant
#   ↓
# MatchResult
#   ↓
# Verification
#   ↓
# Standing / Bracket
#
# Supports:
#   CLASSIC
#   VERSUS
#
# Participant types:
#   PLAYER
#   TEAM
#
# =========================================================


# =========================================================
# COMPETITION
# =========================================================

class Competition(db.Model):

    __tablename__ = "competitions"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    # -----------------------------------------------------
    # Basic information
    # -----------------------------------------------------

    title = db.Column(
        db.String(200),
        nullable=False
    )

    slug = db.Column(
        db.String(220),
        unique=True,
        nullable=False,
        index=True
    )

    description = db.Column(
        db.Text,
        nullable=True
    )

    # -----------------------------------------------------
    # Organizer
    # -----------------------------------------------------

    organizer_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    # -----------------------------------------------------
    # Game
    # -----------------------------------------------------

    game_id = db.Column(
        db.String(50),
        db.ForeignKey("games.id"),
        nullable=False,
        index=True
    )

    # -----------------------------------------------------
    # Competition configuration
    # -----------------------------------------------------

    competition_type = db.Column(
        db.String(30),
        nullable=False
    )
    # CLASSIC
    # VERSUS

    game_mode = db.Column(
        db.String(50),
        nullable=False
    )

    participant_type = db.Column(
        db.String(20),
        nullable=False
    )
    # PLAYER
    # TEAM

    team_size = db.Column(
        db.Integer,
        nullable=False,
        default=1
    )

    max_participants = db.Column(
        db.Integer,
        nullable=False
    )

    # -----------------------------------------------------
    # Competition structure
    # -----------------------------------------------------

    number_of_matches = db.Column(
        db.Integer,
        nullable=False,
        default=1
    )

    structure = db.Column(
        db.String(50),
        nullable=False
    )
    # POINTS
    # KNOCKOUT

    # -----------------------------------------------------
    # Configuration JSON
    # -----------------------------------------------------

    configuration = db.Column(
        db.JSON,
        nullable=False,
        default=dict
    )

    # Example:
    #
    # {
    #     "seeding": "RANDOM",
    #     "allowByes": true,
    #     "scoring": {
    #         "placementPoints": {
    #             "1": 15,
    #             "2": 12,
    #             "3": 10
    #         },
    #         "killPoints": 1
    #     }
    # }

    # -----------------------------------------------------
    # Lifecycle
    # -----------------------------------------------------

    status = db.Column(
        db.String(30),
        nullable=False,
        default="DRAFT",
        index=True
    )

    # DRAFT
    # REGISTRATION_OPEN
    # REGISTRATION_CLOSED
    # READY
    # LIVE
    # RESULTS_PENDING
    # COMPLETED
    # DISPUTED
    # CANCELLED

    # -----------------------------------------------------
    # Schedule
    # -----------------------------------------------------

    registration_start = db.Column(
        db.DateTime,
        nullable=True
    )

    registration_end = db.Column(
        db.DateTime,
        nullable=True
    )

    competition_start = db.Column(
        db.DateTime,
        nullable=True
    )

    competition_end = db.Column(
        db.DateTime,
        nullable=True
    )

    # -----------------------------------------------------
    # Rules
    # -----------------------------------------------------

    competition_rules = db.Column(
        db.Text,
        nullable=True
    )

    match_rules = db.Column(
        db.Text,
        nullable=True
    )

    eligibility_rules = db.Column(
        db.Text,
        nullable=True
    )

    # -----------------------------------------------------
    # Publish
    # -----------------------------------------------------

    is_published = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
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

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    # =====================================================
    # RELATIONSHIPS
    # =====================================================

    organizer = db.relationship(
        "User",
        foreign_keys=[organizer_id],
        backref=db.backref(
            "organized_competitions",
            lazy=True
        )
    )

    game = db.relationship(
        "Game",
        foreign_keys=[game_id],
        backref=db.backref(
            "competitions",
            lazy=True
        )
    )

    stages = db.relationship(
        "CompetitionStage",
        back_populates="competition",
        cascade="all, delete-orphan",
        lazy=True,
        order_by="CompetitionStage.stage_order"
    )

    participants = db.relationship(
        "CompetitionParticipant",
        back_populates="competition",
        cascade="all, delete-orphan",
        lazy=True
    )

    matches = db.relationship(
        "CompetitionMatch",
        back_populates="competition",
        cascade="all, delete-orphan",
        lazy=True
    )

    standings = db.relationship(
        "CompetitionStanding",
        back_populates="competition",
        cascade="all, delete-orphan",
        lazy=True
    )

    bracket = db.relationship(
        "Bracket",
        back_populates="competition",
        uselist=False,
        cascade="all, delete-orphan"
    )

    disputes = db.relationship(
        "CompetitionDispute",
        back_populates="competition",
        cascade="all, delete-orphan",
        lazy=True
    )

    audit_logs = db.relationship(
        "CompetitionAuditLog",
        back_populates="competition",
        cascade="all, delete-orphan",
        lazy=True
    )

    # Tournament registration invitations and host substitution requests.
    team_invites = db.relationship(
        "CompetitionTeamInvite",
        back_populates="competition",
        cascade="all, delete-orphan",
        lazy=True
    )

    substitution_requests = db.relationship(
        "CompetitionSubstitutionRequest",
        back_populates="competition",
        cascade="all, delete-orphan",
        lazy=True
    )

    # =====================================================
    # SERIALIZATION
    # =====================================================

    def to_dict(self):

        return {
            "id": self.id,
            "title": self.title,
            "slug": self.slug,
            "description": self.description,

            "organizerId": self.organizer_id,

            "gameId": self.game_id,

            "game": (
                self.game.to_dict()
                if self.game
                else None
            ),

            "competitionType": self.competition_type,
            "gameMode": self.game_mode,

            "participantType": self.participant_type,
            "teamSize": self.team_size,

            "maxParticipants": self.max_participants,

            "numberOfMatches": self.number_of_matches,
            "structure": self.structure,

            "configuration": self.configuration or {},

            "status": self.status,

            "registrationStart": (
                self.registration_start.isoformat()
                if self.registration_start
                else None
            ),

            "registrationEnd": (
                self.registration_end.isoformat()
                if self.registration_end
                else None
            ),

            "competitionStart": (
                self.competition_start.isoformat()
                if self.competition_start
                else None
            ),

            "competitionEnd": (
                self.competition_end.isoformat()
                if self.competition_end
                else None
            ),

            "competitionRules": self.competition_rules,
            "matchRules": self.match_rules,
            "eligibilityRules": self.eligibility_rules,

            "isPublished": self.is_published,

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
# COMPETITION STAGE
# =========================================================

class CompetitionStage(db.Model):

    __tablename__ = "competition_stages"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    competition_id = db.Column(
        db.Integer,
        db.ForeignKey("competitions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    name = db.Column(
        db.String(150),
        nullable=False
    )

    stage_type = db.Column(
        db.String(30),
        nullable=False
    )
    # MAIN
    # GROUP
    # PLAYOFF
    # FINAL

    stage_order = db.Column(
        db.Integer,
        nullable=False,
        default=1
    )

    status = db.Column(
        db.String(30),
        nullable=False,
        default="PENDING"
    )

    configuration = db.Column(
        db.JSON,
        nullable=False,
        default=dict
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    competition = db.relationship(
        "Competition",
        back_populates="stages"
    )

    matches = db.relationship(
        "CompetitionMatch",
        back_populates="stage",
        cascade="all, delete-orphan",
        lazy=True,
        order_by="CompetitionMatch.match_number"
    )

    standings = db.relationship(
        "CompetitionStanding",
        back_populates="stage",
        cascade="all, delete-orphan",
        lazy=True
    )

    def to_dict(self):

        return {
            "id": self.id,
            "competitionId": self.competition_id,
            "name": self.name,
            "stageType": self.stage_type,
            "stageOrder": self.stage_order,
            "status": self.status,
            "configuration": self.configuration or {}
        }


# =========================================================
# COMPETITION PARTICIPANT
# =========================================================

class CompetitionParticipant(db.Model):

    __tablename__ = "competition_participants"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    competition_id = db.Column(
        db.Integer,
        db.ForeignKey("competitions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    participant_type = db.Column(
        db.String(20),
        nullable=False
    )
    # PLAYER
    # TEAM

    # -----------------------------------------------------
    # PLAYER PARTICIPANT
    # -----------------------------------------------------

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=True,
        index=True
    )

    # -----------------------------------------------------
    # TEAM PARTICIPANT
    # -----------------------------------------------------

    club_id = db.Column(
        db.Integer,
        db.ForeignKey("clubs.id"),
        nullable=True,
        index=True
    )
        # -----------------------------------------------------
    # TOURNAMENT-SPECIFIC TEAM ROSTER
    # -----------------------------------------------------
    # Exact players selected from the club for this
    # particular tournament registration.

    team_roster = db.Column(
        db.JSON,
        nullable=False,
        default=list
    )
    # -----------------------------------------------------
    # Registration
    # -----------------------------------------------------

    seed = db.Column(
        db.Integer,
        nullable=True
    )

    registration_status = db.Column(
        db.String(30),
        nullable=False,
        default="PENDING"
    )
    # PENDING
    # ACCEPTED
    # REJECTED
    # CANCELLED
    # LOCKED
    # DISQUALIFIED
    # ELIMINATED

    registered_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    accepted_at = db.Column(
        db.DateTime,
        nullable=True
    )

    eliminated_at = db.Column(
        db.DateTime,
        nullable=True
    )

    competition = db.relationship(
        "Competition",
        back_populates="participants"
    )

    user = db.relationship(
        "User",
        foreign_keys=[user_id],
        backref=db.backref(
            "competition_participations",
            lazy=True
        )
    )

    club = db.relationship(
        "Club",
        foreign_keys=[club_id],
        backref=db.backref(
            "competition_participations",
            lazy=True
        )
    )

    match_participations = db.relationship(
        "MatchParticipant",
        back_populates="competition_participant",
        cascade="all, delete-orphan",
        lazy=True
    )

    standings = db.relationship(
        "CompetitionStanding",
        back_populates="participant",
        cascade="all, delete-orphan",
        lazy=True
    )

    team_invites = db.relationship(
        "CompetitionTeamInvite",
        back_populates="participant",
        cascade="all, delete-orphan",
        lazy=True
    )

    substitution_requests = db.relationship(
        "CompetitionSubstitutionRequest",
        back_populates="participant",
        cascade="all, delete-orphan",
        lazy=True
    )

    __table_args__ = (
        # A player may have historical CANCELLED/REJECTED rows in the same
        # competition. Only one active/locked/eliminated commitment is
        # allowed for the same (competition, user). This also covers TEAM
        # captains because the captain is stored in user_id.
        db.Index(
            "uq_competition_player_participant_active",
            "competition_id",
            "user_id",
            unique=True,
            postgresql_where=text(
                "user_id IS NOT NULL AND registration_status NOT IN ('REJECTED', 'CANCELLED', 'DISQUALIFIED')"
            ),
            sqlite_where=text(
                "user_id IS NOT NULL AND registration_status NOT IN ('REJECTED', 'CANCELLED', 'DISQUALIFIED')"
            ),
        ),
        db.CheckConstraint(
            "(participant_type = 'PLAYER' AND user_id IS NOT NULL AND club_id IS NULL) "
            "OR (participant_type = 'TEAM' AND club_id IS NOT NULL)",
            name="competition_participants_check",
        ),
    )

    def display_name(self):

        if self.participant_type == "TEAM" and self.club:
            return self.club.name

        if self.user:
            return self.user.username or self.user.name

        return "Unknown Participant"

    def to_dict(self):

        return {
            "id": self.id,

            "competitionId": self.competition_id,

            "participantType": self.participant_type,

            "userId": self.user_id,
            "captainId": (
                self.user_id
                if self.participant_type == "TEAM"
                else None
            ),
            "clubId": self.club_id,

            "teamRoster": self.team_roster or [],
            "rosterCount": len(self.team_roster or []),

            "seed": self.seed,

            "registrationStatus": self.registration_status,

            "registeredAt": (
                self.registered_at.isoformat()
                if self.registered_at
                else None
            ),

            "acceptedAt": (
                self.accepted_at.isoformat()
                if self.accepted_at
                else None
            ),

            "eliminatedAt": (
                self.eliminated_at.isoformat()
                if self.eliminated_at
                else None
            ),

            "displayName": self.display_name(),

            "user": (
                self.user.to_dict()
                if self.user
                else None
            ),

            "club": (
                self.club.to_dict()
                if self.club
                else None
            )
        }


# =========================================================
# COMPETITION TEAM INVITE
# =========================================================
#
# Tracks each teammate invitation for a tournament entry.
# The actual accepted roster snapshot remains on
# CompetitionParticipant.team_roster for compatibility with
# the existing live tournament system.
# =========================================================

class CompetitionTeamInvite(db.Model):

    __tablename__ = "competition_team_invites"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    competition_id = db.Column(
        db.Integer,
        db.ForeignKey("competitions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    participant_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "competition_participants.id",
            ondelete="CASCADE"
        ),
        nullable=False,
        index=True
    )

    invited_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    invited_by = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    slot_number = db.Column(
        db.Integer,
        nullable=False
    )

    invite_type = db.Column(
        db.String(40),
        nullable=False,
        default="TEAM_MEMBER"
    )
    # TEAM_MEMBER
    # REPLACEMENT
    # SUBSTITUTION

    status = db.Column(
        db.String(20),
        nullable=False,
        default="PENDING",
        index=True
    )
    # PENDING
    # ACCEPTED
    # DECLINED
    # EXPIRED
    # CANCELLED

    replaces_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    substitution_request_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "competition_substitution_requests.id",
            ondelete="SET NULL"
        ),
        nullable=True,
        index=True
    )

    expires_at = db.Column(
        db.DateTime,
        nullable=False,
        index=True
    )

    halfway_reminded_at = db.Column(
        db.DateTime,
        nullable=True
    )

    last_hour_reminded_at = db.Column(
        db.DateTime,
        nullable=True
    )

    responded_at = db.Column(
        db.DateTime,
        nullable=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True
    )

    competition = db.relationship(
        "Competition",
        back_populates="team_invites"
    )

    participant = db.relationship(
        "CompetitionParticipant",
        back_populates="team_invites"
    )

    invited_user = db.relationship(
        "User",
        foreign_keys=[invited_user_id]
    )

    inviter = db.relationship(
        "User",
        foreign_keys=[invited_by]
    )

    replaces_user = db.relationship(
        "User",
        foreign_keys=[replaces_user_id]
    )

    def to_dict(self):

        return {
            "id": self.id,
            "competitionId": self.competition_id,
            "participantId": self.participant_id,
            "invitedUserId": self.invited_user_id,
            "invitedBy": self.invited_by,
            "slotNumber": self.slot_number,
            "inviteType": self.invite_type,
            "status": self.status,
            "replacesUserId": self.replaces_user_id,
            "substitutionRequestId": self.substitution_request_id,
            "expiresAt": (
                self.expires_at.isoformat()
                if self.expires_at
                else None
            ),
            "halfwayRemindedAt": (
                self.halfway_reminded_at.isoformat()
                if self.halfway_reminded_at
                else None
            ),
            "lastHourRemindedAt": (
                self.last_hour_reminded_at.isoformat()
                if self.last_hour_reminded_at
                else None
            ),
            "respondedAt": (
                self.responded_at.isoformat()
                if self.responded_at
                else None
            ),
            "createdAt": (
                self.created_at.isoformat()
                if self.created_at
                else None
            ),
            "user": (
                {
                    "id": self.invited_user.id,
                    "uid": self.invited_user.uid,
                    "name": self.invited_user.name,
                    "username": self.invited_user.username,
                    "avatar": self.invited_user.avatar,
                }
                if self.invited_user
                else None
            )
        }


# =========================================================
# COMPETITION SUBSTITUTION REQUEST
# =========================================================

class CompetitionSubstitutionRequest(db.Model):

    __tablename__ = "competition_substitution_requests"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    competition_id = db.Column(
        db.Integer,
        db.ForeignKey("competitions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    participant_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "competition_participants.id",
            ondelete="CASCADE"
        ),
        nullable=False,
        index=True
    )

    captain_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    outgoing_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    replacement_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    reason = db.Column(
        db.Text,
        nullable=False
    )

    status = db.Column(
        db.String(30),
        nullable=False,
        default="PENDING",
        index=True
    )
    # PENDING
    # APPROVED
    # REJECTED
    # COMPLETED

    requested_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True
    )

    decision_deadline = db.Column(
        db.DateTime,
        nullable=False,
        index=True
    )

    decided_at = db.Column(
        db.DateTime,
        nullable=True
    )

    decided_by = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    rejection_reason = db.Column(
        db.Text,
        nullable=True
    )

    completed_at = db.Column(
        db.DateTime,
        nullable=True
    )

    replacement_invite_id = db.Column(
        db.Integer,
        nullable=True,
        index=True
    )

    competition = db.relationship(
        "Competition",
        back_populates="substitution_requests"
    )

    participant = db.relationship(
        "CompetitionParticipant",
        back_populates="substitution_requests"
    )

    captain = db.relationship(
        "User",
        foreign_keys=[captain_id]
    )

    outgoing_user = db.relationship(
        "User",
        foreign_keys=[outgoing_user_id]
    )

    replacement_user = db.relationship(
        "User",
        foreign_keys=[replacement_user_id]
    )

    decider = db.relationship(
        "User",
        foreign_keys=[decided_by]
    )

    def to_dict(self):

        def user_payload(user):
            if not user:
                return None
            return {
                "id": user.id,
                "uid": user.uid,
                "name": user.name,
                "username": user.username,
                "avatar": user.avatar,
            }

        return {
            "id": self.id,
            "competitionId": self.competition_id,
            "participantId": self.participant_id,
            "captainId": self.captain_id,
            "outgoingUserId": self.outgoing_user_id,
            "replacementUserId": self.replacement_user_id,
            "reason": self.reason,
            "status": self.status,
            "requestedAt": self.requested_at.isoformat() if self.requested_at else None,
            "decisionDeadline": self.decision_deadline.isoformat() if self.decision_deadline else None,
            "decidedAt": self.decided_at.isoformat() if self.decided_at else None,
            "decidedBy": self.decided_by,
            "rejectionReason": self.rejection_reason,
            "completedAt": self.completed_at.isoformat() if self.completed_at else None,
            "replacementInviteId": self.replacement_invite_id,
            "captain": user_payload(self.captain),
            "outgoingUser": user_payload(self.outgoing_user),
            "replacementUser": user_payload(self.replacement_user),
        }


# =========================================================
# COMPETITION MATCH
# =========================================================

class CompetitionMatch(db.Model):

    __tablename__ = "competition_matches"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    competition_id = db.Column(
        db.Integer,
        db.ForeignKey("competitions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    stage_id = db.Column(
        db.Integer,
        db.ForeignKey("competition_stages.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # -----------------------------------------------------
    # Match identification
    # -----------------------------------------------------

    match_number = db.Column(
        db.Integer,
        nullable=False
    )

    round_name = db.Column(
        db.String(50),
        nullable=True
    )

    round_number = db.Column(
        db.Integer,
        nullable=True
    )

    # -----------------------------------------------------
    # Scheduling
    # -----------------------------------------------------

    scheduled_at = db.Column(
        db.DateTime,
        nullable=True,
        index=True
    )

    started_at = db.Column(
        db.DateTime,
        nullable=True
    )

    completed_at = db.Column(
        db.DateTime,
        nullable=True
    )

    # -----------------------------------------------------
    # Status
    # -----------------------------------------------------

    status = db.Column(
        db.String(30),
        nullable=False,
        default="SCHEDULED",
        index=True
    )

    # SCHEDULED
    # READY
    # LIVE
    # RESULT_PENDING
    # VERIFICATION
    # VERIFIED
    # DISPUTED
    # CANCELLED

    # -----------------------------------------------------
    # Match metadata
    # -----------------------------------------------------

    match_metadata = db.Column(
        "metadata",
        db.JSON,
        nullable=False,
        default=dict
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    competition = db.relationship(
        "Competition",
        back_populates="matches"
    )

    stage = db.relationship(
        "CompetitionStage",
        back_populates="matches"
    )

    sides = db.relationship(
        "MatchSide",
        back_populates="match",
        cascade="all, delete-orphan",
        lazy=True,
        order_by="MatchSide.side_number"
    )

    participants = db.relationship(
        "MatchParticipant",
        back_populates="match",
        cascade="all, delete-orphan",
        lazy=True
    )

    result = db.relationship(
        "MatchResult",
        back_populates="match",
        uselist=False,
        cascade="all, delete-orphan"
    )

    verification_records = db.relationship(
        "VerificationRecord",
        back_populates="match",
        cascade="all, delete-orphan",
        lazy=True
    )

    disputes = db.relationship(
        "CompetitionDispute",
        back_populates="match",
        cascade="all, delete-orphan",
        lazy=True
    )

    def to_dict(self):

        return {
            "id": self.id,

            "competitionId": self.competition_id,
            "stageId": self.stage_id,

            "matchNumber": self.match_number,

            "roundName": self.round_name,
            "roundNumber": self.round_number,

            "scheduledAt": (
                self.scheduled_at.isoformat()
                if self.scheduled_at
                else None
            ),

            "startedAt": (
                self.started_at.isoformat()
                if self.started_at
                else None
            ),

            "completedAt": (
                self.completed_at.isoformat()
                if self.completed_at
                else None
            ),

            "status": self.status,

            "metadata": self.match_metadata or {},

            "sides": [
                side.to_dict()
                for side in self.sides
            ],

            "result": (
                self.result.to_dict()
                if self.result
                else None
            )
        }


# =========================================================
# MATCH SIDE
# =========================================================

class MatchSide(db.Model):

    __tablename__ = "match_sides"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    match_id = db.Column(
        db.Integer,
        db.ForeignKey("competition_matches.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    side_number = db.Column(
        db.Integer,
        nullable=False
    )
    # 1 = Side A
    # 2 = Side B

    label = db.Column(
        db.String(50),
        nullable=True
    )

    # Used by knockout brackets
    source_node_id = db.Column(
        db.Integer,
        nullable=True
    )

    source_result = db.Column(
        db.String(30),
        nullable=True
    )
    # WINNER
    # LOSER

    status = db.Column(
        db.String(30),
        nullable=False,
        default="PENDING"
    )

    match = db.relationship(
        "CompetitionMatch",
        back_populates="sides"
    )

    participants = db.relationship(
        "MatchParticipant",
        back_populates="side",
        cascade="all, delete-orphan",
        lazy=True
    )

    __table_args__ = (
        db.UniqueConstraint(
            "match_id",
            "side_number",
            name="uq_match_side_number"
        ),
    )

    def to_dict(self):

        return {
            "id": self.id,
            "matchId": self.match_id,
            "sideNumber": self.side_number,
            "label": self.label,

            "sourceNodeId": self.source_node_id,
            "sourceResult": self.source_result,

            "status": self.status,

            "participants": [
                participant.to_dict()
                for participant in self.participants
            ]
        }


# =========================================================
# MATCH PARTICIPANT
# =========================================================

class MatchParticipant(db.Model):

    __tablename__ = "match_participants"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    match_id = db.Column(
        db.Integer,
        db.ForeignKey("competition_matches.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    side_id = db.Column(
        db.Integer,
        db.ForeignKey("match_sides.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    competition_participant_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "competition_participants.id",
            ondelete="CASCADE"
        ),
        nullable=False,
        index=True
    )

    match = db.relationship(
        "CompetitionMatch",
        back_populates="participants"
    )

    side = db.relationship(
        "MatchSide",
        back_populates="participants"
    )

    competition_participant = db.relationship(
        "CompetitionParticipant",
        back_populates="match_participations"
    )

    def to_dict(self):

        return {
            "id": self.id,

            "matchId": self.match_id,
            "sideId": self.side_id,

            "competitionParticipantId":
                self.competition_participant_id,

            "participant": (
                self.competition_participant.to_dict()
                if self.competition_participant
                else None
            )
        }


# =========================================================
# SCORING RULE
# =========================================================

class ScoringRule(db.Model):

    __tablename__ = "competition_scoring_rules"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    competition_id = db.Column(
        db.Integer,
        db.ForeignKey("competitions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    rule_type = db.Column(
        db.String(50),
        nullable=False
    )
    # PLACEMENT
    # KILL
    # BONUS
    # CUSTOM

    name = db.Column(
        db.String(100),
        nullable=False
    )

    points = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    configuration = db.Column(
        db.JSON,
        nullable=False,
        default=dict
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    competition = db.relationship(
        "Competition",
        backref=db.backref(
            "scoring_rules",
            lazy=True,
            cascade="all, delete-orphan"
        )
    )

    def to_dict(self):

        return {
            "id": self.id,
            "competitionId": self.competition_id,
            "ruleType": self.rule_type,
            "name": self.name,
            "points": self.points,
            "configuration": self.configuration or {}
        }


# =========================================================
# MATCH RESULT
# =========================================================

class MatchResult(db.Model):

    __tablename__ = "match_results"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    match_id = db.Column(
        db.Integer,
        db.ForeignKey("competition_matches.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True
    )

    submitted_by = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    # -----------------------------------------------------
    # Versus
    # -----------------------------------------------------

    winning_side_id = db.Column(
        db.Integer,
        db.ForeignKey("match_sides.id"),
        nullable=True
    )

    # -----------------------------------------------------
    # Result status
    # -----------------------------------------------------

    status = db.Column(
        db.String(30),
        nullable=False,
        default="SUBMITTED"
    )
    # SUBMITTED
    # VERIFIED
    # REJECTED
    # DISPUTED
    # INVALIDATED

    # -----------------------------------------------------
    # Raw result data
    # -----------------------------------------------------

    raw_result = db.Column(
        db.JSON,
        nullable=False,
        default=dict
    )

    submitted_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    verified_at = db.Column(
        db.DateTime,
        nullable=True
    )

    verified_by = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=True
    )

    notes = db.Column(
        db.Text,
        nullable=True
    )

    match = db.relationship(
        "CompetitionMatch",
        back_populates="result"
    )

    submitter = db.relationship(
        "User",
        foreign_keys=[submitted_by]
    )

    verifier = db.relationship(
        "User",
        foreign_keys=[verified_by]
    )

    winning_side = db.relationship(
        "MatchSide",
        foreign_keys=[winning_side_id]
    )

    def to_dict(self):

        return {
            "id": self.id,

            "matchId": self.match_id,

            "submittedBy": self.submitted_by,

            "winningSideId": self.winning_side_id,

            "status": self.status,

            "rawResult": self.raw_result or {},

            "submittedAt": (
                self.submitted_at.isoformat()
                if self.submitted_at
                else None
            ),

            "verifiedAt": (
                self.verified_at.isoformat()
                if self.verified_at
                else None
            ),

            "verifiedBy": self.verified_by,

            "notes": self.notes
        }


# =========================================================
# TEAM MATCH STATS
# =========================================================

class TeamMatchStats(db.Model):

    __tablename__ = "team_match_stats"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    match_id = db.Column(
        db.Integer,
        db.ForeignKey("competition_matches.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    competition_participant_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "competition_participants.id",
            ondelete="CASCADE"
        ),
        nullable=False,
        index=True
    )

    placement = db.Column(
        db.Integer,
        nullable=True
    )

    kills = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    placement_points = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    kill_points = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    bonus_points = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    total_points = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    match = db.relationship(
        "CompetitionMatch",
        backref=db.backref(
            "team_stats",
            lazy=True,
            cascade="all, delete-orphan"
        )
    )

    participant = db.relationship(
        "CompetitionParticipant",
        backref=db.backref(
            "team_match_stats",
            lazy=True,
            cascade="all, delete-orphan"
        )
    )

    __table_args__ = (
        db.UniqueConstraint(
            "match_id",
            "competition_participant_id",
            name="uq_team_match_stats"
        ),
    )

    def to_dict(self):

        return {
            "id": self.id,
            "matchId": self.match_id,
            "competitionParticipantId":
                self.competition_participant_id,

            "placement": self.placement,
            "kills": self.kills,

            "placementPoints": self.placement_points,
            "killPoints": self.kill_points,
            "bonusPoints": self.bonus_points,

            "totalPoints": self.total_points
        }


# =========================================================
# PLAYER MATCH STATS
# =========================================================

class PlayerMatchStats(db.Model):

    __tablename__ = "player_match_stats"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    match_id = db.Column(
        db.Integer,
        db.ForeignKey("competition_matches.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    competition_participant_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "competition_participants.id",
            ondelete="CASCADE"
        ),
        nullable=False,
        index=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    kills = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    assists = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    deaths = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    score = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    extra_stats = db.Column(
        db.JSON,
        nullable=False,
        default=dict
    )

    match = db.relationship(
        "CompetitionMatch",
        backref=db.backref(
            "player_stats",
            lazy=True,
            cascade="all, delete-orphan"
        )
    )

    competition_participant = db.relationship(
        "CompetitionParticipant",
        backref=db.backref(
            "player_match_stats",
            lazy=True,
            cascade="all, delete-orphan"
        )
    )

    user = db.relationship(
        "User",
        foreign_keys=[user_id],
        backref=db.backref(
            "competition_match_stats",
            lazy=True
        )
    )

    __table_args__ = (
        db.UniqueConstraint(
            "match_id",
            "user_id",
            name="uq_player_match_stats"
        ),
    )

    def to_dict(self):

        return {
            "id": self.id,

            "matchId": self.match_id,

            "competitionParticipantId":
                self.competition_participant_id,

            "userId": self.user_id,

            "kills": self.kills,
            "assists": self.assists,
            "deaths": self.deaths,

            "score": self.score,

            "extraStats": self.extra_stats or {}
        }


# =========================================================
# COMPETITION STANDING
# =========================================================

class CompetitionStanding(db.Model):

    __tablename__ = "competition_standings"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    competition_id = db.Column(
        db.Integer,
        db.ForeignKey("competitions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    stage_id = db.Column(
        db.Integer,
        db.ForeignKey("competition_stages.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    competition_participant_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "competition_participants.id",
            ondelete="CASCADE"
        ),
        nullable=False,
        index=True
    )

    rank = db.Column(
        db.Integer,
        nullable=True
    )

    matches_played = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    wins = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    losses = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    placement_points = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    kill_points = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    bonus_points = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    total_points = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    best_match_score = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    total_kills = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    competition = db.relationship(
        "Competition",
        back_populates="standings"
    )

    stage = db.relationship(
        "CompetitionStage",
        back_populates="standings"
    )

    participant = db.relationship(
        "CompetitionParticipant",
        back_populates="standings"
    )

    __table_args__ = (
        db.UniqueConstraint(
            "competition_id",
            "stage_id",
            "competition_participant_id",
            name="uq_competition_standing"
        ),
    )

    def to_dict(self):

        return {
            "id": self.id,

            "competitionId": self.competition_id,
            "stageId": self.stage_id,

            "competitionParticipantId":
                self.competition_participant_id,

            "rank": self.rank,

            "matchesPlayed": self.matches_played,

            "wins": self.wins,
            "losses": self.losses,

            "placementPoints": self.placement_points,
            "killPoints": self.kill_points,
            "bonusPoints": self.bonus_points,

            "totalPoints": self.total_points,

            "bestMatchScore": self.best_match_score,
            "totalKills": self.total_kills,

            "updatedAt": (
                self.updated_at.isoformat()
                if self.updated_at
                else None
            ),

            "participant": (
                self.participant.to_dict()
                if self.participant
                else None
            )
        }


# =========================================================
# BRACKET
# =========================================================

class Bracket(db.Model):

    __tablename__ = "competition_brackets"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    competition_id = db.Column(
        db.Integer,
        db.ForeignKey("competitions.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True
    )

    bracket_type = db.Column(
        db.String(30),
        nullable=False,
        default="SINGLE_ELIMINATION"
    )

    participant_count = db.Column(
        db.Integer,
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    competition = db.relationship(
        "Competition",
        back_populates="bracket"
    )

    nodes = db.relationship(
        "BracketNode",
        back_populates="bracket",
        cascade="all, delete-orphan",
        lazy=True,
        order_by="BracketNode.node_order"
    )

    def to_dict(self):

        return {
            "id": self.id,

            "competitionId": self.competition_id,

            "bracketType": self.bracket_type,

            "participantCount": self.participant_count,

            "nodes": [
                node.to_dict()
                for node in self.nodes
            ],

            "createdAt": (
                self.created_at.isoformat()
                if self.created_at
                else None
            )
        }


# =========================================================
# BRACKET NODE
# =========================================================

class BracketNode(db.Model):

    __tablename__ = "bracket_nodes"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    bracket_id = db.Column(
        db.Integer,
        db.ForeignKey("competition_brackets.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    stage_id = db.Column(
        db.Integer,
        db.ForeignKey("competition_stages.id"),
        nullable=True,
        index=True
    )

    match_id = db.Column(
        db.Integer,
        db.ForeignKey("competition_matches.id"),
        nullable=True,
        unique=True
    )

    # -----------------------------------------------------
    # Node identity
    # -----------------------------------------------------

    node_order = db.Column(
        db.Integer,
        nullable=False
    )

    round_number = db.Column(
        db.Integer,
        nullable=False
    )

    round_name = db.Column(
        db.String(50),
        nullable=False
    )

    match_number = db.Column(
        db.Integer,
        nullable=False
    )

    # -----------------------------------------------------
    # Participants
    # -----------------------------------------------------

    side_a_participant_id = db.Column(
        db.Integer,
        db.ForeignKey("competition_participants.id"),
        nullable=True
    )

    side_b_participant_id = db.Column(
        db.Integer,
        db.ForeignKey("competition_participants.id"),
        nullable=True
    )

    winner_participant_id = db.Column(
        db.Integer,
        db.ForeignKey("competition_participants.id"),
        nullable=True
    )

    # -----------------------------------------------------
    # Advancement
    # -----------------------------------------------------

    winner_destination_node_id = db.Column(
        db.Integer,
        nullable=True
    )

    # -----------------------------------------------------
    # BYE
    # -----------------------------------------------------

    is_bye = db.Column(
        db.Boolean,
        nullable=False,
        default=False
    )

    bye_participant_id = db.Column(
        db.Integer,
        db.ForeignKey("competition_participants.id"),
        nullable=True
    )

    status = db.Column(
        db.String(30),
        nullable=False,
        default="PENDING"
    )

    bracket = db.relationship(
        "Bracket",
        back_populates="nodes"
    )

    match = db.relationship(
        "CompetitionMatch",
        foreign_keys=[match_id]
    )

    side_a_participant = db.relationship(
        "CompetitionParticipant",
        foreign_keys=[side_a_participant_id]
    )

    side_b_participant = db.relationship(
        "CompetitionParticipant",
        foreign_keys=[side_b_participant_id]
    )

    winner_participant = db.relationship(
        "CompetitionParticipant",
        foreign_keys=[winner_participant_id]
    )

    bye_participant = db.relationship(
        "CompetitionParticipant",
        foreign_keys=[bye_participant_id]
    )

    def to_dict(self):

        return {
            "id": self.id,

            "bracketId": self.bracket_id,

            "stageId": self.stage_id,

            "matchId": self.match_id,

            "nodeOrder": self.node_order,

            "roundNumber": self.round_number,
            "roundName": self.round_name,
            "matchNumber": self.match_number,

            "sideA": (
                self.side_a_participant.to_dict()
                if self.side_a_participant
                else None
            ),

            "sideB": (
                self.side_b_participant.to_dict()
                if self.side_b_participant
                else None
            ),

            "winner": (
                self.winner_participant.to_dict()
                if self.winner_participant
                else None
            ),

            "winnerDestinationNodeId":
                self.winner_destination_node_id,

            "isBye": self.is_bye,

            "byeParticipant": (
                self.bye_participant.to_dict()
                if self.bye_participant
                else None
            ),

            "status": self.status
        }


# =========================================================
# VERIFICATION RECORD
# =========================================================

class VerificationRecord(db.Model):

    __tablename__ = "competition_verification_records"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    match_id = db.Column(
        db.Integer,
        db.ForeignKey("competition_matches.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    verifier_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    action = db.Column(
        db.String(30),
        nullable=False
    )
    # VERIFIED
    # REJECTED
    # INVALIDATED
    # REOPENED

    reason = db.Column(
        db.Text,
        nullable=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    match = db.relationship(
        "CompetitionMatch",
        back_populates="verification_records"
    )

    verifier = db.relationship(
        "User",
        foreign_keys=[verifier_id]
    )

    def to_dict(self):

        return {
            "id": self.id,

            "matchId": self.match_id,

            "verifierId": self.verifier_id,

            "action": self.action,

            "reason": self.reason,

            "createdAt": (
                self.created_at.isoformat()
                if self.created_at
                else None
            )
        }


# =========================================================
# COMPETITION DISPUTE
# =========================================================

class CompetitionDispute(db.Model):

    __tablename__ = "competition_disputes"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    competition_id = db.Column(
        db.Integer,
        db.ForeignKey("competitions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    match_id = db.Column(
        db.Integer,
        db.ForeignKey("competition_matches.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    raised_by = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    reason = db.Column(
        db.Text,
        nullable=False
    )

    status = db.Column(
        db.String(30),
        nullable=False,
        default="OPEN",
        index=True
    )
    # OPEN
    # CONFIRMED
    # CORRECTED
    # REPLAY
    # CANCELLED
    # RESOLVED

    resolution = db.Column(
        db.Text,
        nullable=True
    )

    resolved_by = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    resolved_at = db.Column(
        db.DateTime,
        nullable=True
    )

    competition = db.relationship(
        "Competition",
        back_populates="disputes"
    )

    match = db.relationship(
        "CompetitionMatch",
        back_populates="disputes"
    )

    raiser = db.relationship(
        "User",
        foreign_keys=[raised_by]
    )

    resolver = db.relationship(
        "User",
        foreign_keys=[resolved_by]
    )

    def to_dict(self):

        return {
            "id": self.id,

            "competitionId": self.competition_id,
            "matchId": self.match_id,

            "raisedBy": self.raised_by,

            "reason": self.reason,

            "status": self.status,

            "resolution": self.resolution,

            "resolvedBy": self.resolved_by,

            "createdAt": (
                self.created_at.isoformat()
                if self.created_at
                else None
            ),

            "resolvedAt": (
                self.resolved_at.isoformat()
                if self.resolved_at
                else None
            )
        }


# =========================================================
# COMPETITION AUDIT LOG
# =========================================================

class CompetitionAuditLog(db.Model):

    __tablename__ = "competition_audit_logs"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    competition_id = db.Column(
        db.Integer,
        db.ForeignKey("competitions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    match_id = db.Column(
        db.Integer,
        db.ForeignKey("competition_matches.id"),
        nullable=True,
        index=True
    )

    actor_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=True,
        index=True
    )

    action = db.Column(
        db.String(100),
        nullable=False
    )

    description = db.Column(
        db.String(1000),
        nullable=True
    )

    audit_metadata = db.Column(
        "metadata",
        db.JSON,
        nullable=False,
        default=dict
    )
    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True
    )

    competition = db.relationship(
        "Competition",
        back_populates="audit_logs"
    )

    actor = db.relationship(
        "User",
        foreign_keys=[actor_id]
    )

    match = db.relationship(
        "CompetitionMatch",
        foreign_keys=[match_id]
    )

    def to_dict(self):

        return {
            "id": self.id,

            "competitionId": self.competition_id,
            "matchId": self.match_id,

            "actorId": self.actor_id,

            "action": self.action,
            "description": self.description,

            "metadata": self.audit_metadata or {},
            
            "createdAt": (
                self.created_at.isoformat()
                if self.created_at
                else None
            )
        }
# =========================================================
# ORGANIZER APPLICATION
# =========================================================

class OrganizerApplication(db.Model):

    __tablename__ = "organizer_applications"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    # -----------------------------------------------------
    # APPLICANT
    # -----------------------------------------------------

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True
    )

    # -----------------------------------------------------
    # APPLICATION ID
    # -----------------------------------------------------

    application_code = db.Column(
        db.String(32),
        unique=True,
        nullable=False,
        index=True
    )

    # -----------------------------------------------------
    # ORGANIZER DETAILS
    # -----------------------------------------------------

    organization_name = db.Column(
        db.String(150),
        nullable=False
    )

    organizer_type = db.Column(
        db.String(50),
        nullable=False
    )

    country = db.Column(
        db.String(100),
        nullable=False
    )

    city = db.Column(
        db.String(100),
        nullable=True
    )

    contact_phone = db.Column(
        db.String(30),
        nullable=False
    )

    # -----------------------------------------------------
    # EXPERIENCE
    # -----------------------------------------------------

    experience_years = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    events_organized = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    largest_event_size = db.Column(
        db.Integer,
        nullable=True
    )

    # JSON stored as PostgreSQL JSONB
    games = db.Column(
        db.JSON,
        nullable=False,
        default=list
    )

    # -----------------------------------------------------
    # ONLINE PRESENCE
    # -----------------------------------------------------

    website_url = db.Column(
        db.String(500),
        nullable=True
    )

    discord_url = db.Column(
        db.String(500),
        nullable=True
    )

    social_url = db.Column(
        db.String(500),
        nullable=True
    )

    # -----------------------------------------------------
    # EXPERIENCE / HISTORY
    # -----------------------------------------------------

    previous_event_url = db.Column(
        db.String(500),
        nullable=True
    )

    experience_description = db.Column(
        db.Text,
        nullable=True
    )

    # -----------------------------------------------------
    # PLANNED SYNCO USAGE
    # -----------------------------------------------------

    planned_games = db.Column(
        db.JSON,
        nullable=False,
        default=list
    )

    tournament_frequency = db.Column(
        db.String(40),
        nullable=False
    )

    expected_participants = db.Column(
        db.Integer,
        nullable=True
    )

    organizer_description = db.Column(
        db.Text,
        nullable=False
    )

    # -----------------------------------------------------
    # APPLICATION STATUS
    # -----------------------------------------------------

    status = db.Column(
        db.String(30),
        nullable=False,
        default="pending",
        index=True
    )

    # pending
    # under_review
    # approved
    # rejected
    # suspended

    rejection_reason = db.Column(
        db.Text,
        nullable=True
    )

    # -----------------------------------------------------
    # REVIEW INFORMATION
    # -----------------------------------------------------

    reviewed_by = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    reviewed_at = db.Column(
        db.DateTime,
        nullable=True
    )

    # -----------------------------------------------------
    # AUDIT INFORMATION
    # -----------------------------------------------------

    submitted_ip = db.Column(
        db.String(64),
        nullable=True
    )

    user_agent = db.Column(
        db.Text,
        nullable=True
    )

    submitted_at = db.Column(
        db.DateTime,
        nullable=False,
        server_default=db.func.now()
    )

    created_at = db.Column(
        db.DateTime,
        nullable=False,
        server_default=db.func.now()
    )

    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        server_default=db.func.now(),
        onupdate=db.func.now()
    )

    # -----------------------------------------------------
    # RELATIONSHIPS
    # -----------------------------------------------------

    applicant = db.relationship(
        "User",
        foreign_keys=[user_id],
        backref=db.backref(
            "organizer_application",
            uselist=False,
            cascade="all, delete-orphan"
        )
    )

    reviewer = db.relationship(
        "User",
        foreign_keys=[reviewed_by]
    )

    def to_dict(self):

        return {
            "id": self.id,
            "application_code": self.application_code,
            "user_id": self.user_id,

            "organization_name": self.organization_name,
            "organizer_type": self.organizer_type,
            "country": self.country,
            "city": self.city,
            "contact_phone": self.contact_phone,

            "experience_years": self.experience_years,
            "events_organized": self.events_organized,
            "largest_event_size": self.largest_event_size,

            "games": self.games or [],

            "website_url": self.website_url,
            "discord_url": self.discord_url,
            "social_url": self.social_url,

            "previous_event_url": self.previous_event_url,
            "experience_description": self.experience_description,

            "planned_games": self.planned_games or [],
            "tournament_frequency": self.tournament_frequency,
            "expected_participants": self.expected_participants,

            "organizer_description": self.organizer_description,

            "status": self.status,
            "rejection_reason": self.rejection_reason,

            "reviewed_by": self.reviewed_by,
            "reviewed_at": (
                self.reviewed_at.isoformat()
                if self.reviewed_at
                else None
            ),

            "submitted_at": (
                self.submitted_at.isoformat()
                if self.submitted_at
                else None
            ),

            "created_at": (
                self.created_at.isoformat()
                if self.created_at
                else None
            ),

            "updated_at": (
                self.updated_at.isoformat()
                if self.updated_at
                else None
            ),
        }


# =========================================================
# ORGANIZER APPLICATION AUDIT LOG
# =========================================================

class OrganizerApplicationAuditLog(db.Model):

    __tablename__ = "organizer_application_audit_logs"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    application_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "organizer_applications.id",
            ondelete="CASCADE"
        ),
        nullable=False,
        index=True
    )

    actor_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "users.id",
            ondelete="SET NULL"
        ),
        nullable=True,
        index=True
    )

    action = db.Column(
        db.String(50),
        nullable=False
    )

    previous_status = db.Column(
        db.String(30),
        nullable=True
    )

    new_status = db.Column(
        db.String(30),
        nullable=True
    )

    reason = db.Column(
        db.Text,
        nullable=True
    )

    audit_metadata = db.Column(
        "metadata",
        db.JSON,
        nullable=True
    )

    ip_address = db.Column(
        db.String(64),
        nullable=True
    )

    user_agent = db.Column(
        db.Text,
        nullable=True
    )

    created_at = db.Column(
        db.DateTime,
        nullable=False,
        server_default=db.func.now()
    )

    application = db.relationship(
        "OrganizerApplication",
        backref=db.backref(
            "audit_logs",
            lazy="dynamic",
            cascade="all, delete-orphan"
        )
    )

    actor = db.relationship(
        "User"
    )

    def to_dict(self):

        return {
            "id": self.id,
            "application_id": self.application_id,
            "actor_id": self.actor_id,
            "action": self.action,
            "previous_status": self.previous_status,
            "new_status": self.new_status,
            "reason": self.reason,
            "metadata": self.audit_metadata or {},
            "created_at": (
                self.created_at.isoformat()
                if self.created_at
                else None
            ),
        }