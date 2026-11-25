import {
  marketplaceStatsApi,
  type MarketplaceStats,
} from "./api/marketplaceStats"
import { supportApi } from "./api/support"
import NotificationBell, {
  NotificationPage,
} from "./features/notifications/Notifications"
import AdminDashboard, { adminPages } from "./features/admin/AdminDashboard"
import DashboardOverview from "./features/dashboard/Overview"
import IntegratedWorkspace from "./features/workspace/IntegratedWorkspace"
import {
  workspaceId,
  openWorkspace,
} from "./features/workspace/productionModel"
import { workspacePages } from "./features/workspace/navigation"
import { RichDescription } from "./components/ui"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { createPortal } from "react-dom"
import {
  AlertCircle,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CircleDollarSign,
  Clock3,
  Code2,
  Download,
  Eye,
  EyeOff,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Inbox,
  Link2,
  LoaderCircle,
  LogOut,
  Mail,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Star,
  UserRound,
  UsersRound,
  X,
} from "lucide-react"
import { jobApi, type Job, type JobSummary } from "./api/jobs"
import {
  publicFreelancersApi,
  type PublicFreelancer,
} from "./api/publicFreelancers"
import { clientCompanyApi } from "./api/clientCompany"
import useSavedJobs from "./features/jobs/useSavedJobs"
import type { SavedJobRecord } from "./api/savedJobs"
import Jobs, { JobSnapshot } from "./features/jobs/Jobs"
import { money } from "./features/jobs/model"
import {
  clientJobQuery,
  navigateClientJobs,
  readClientJobRoute,
} from "./features/jobs/navigation"
import ProposalsScreen, {
  Assignments as AssignmentsScreen,
  SubmitProposal,
} from "./features/recruitment/Recruitment"
import {
  adminApi,
  cvApi,
  freelancerApi,
  portfolioApi,
  resolveAvatarUrl,
  skillApi,
  userApi,
  workExperienceApi,
  type UserDto,
  type WorkExperienceDto,
  type WorkExperienceInput,
  type PortfolioDto,
  type PortfolioInput,
} from "./api/platform"
import { authApi, passwordError, type AuthUser } from "./api/auth"
import {
  getAccessToken,
  getSessionSnapshot,
  subscribeSession,
  initializeSession,
  uiRole,
  canUseDashboard,
  sessionGeneration,
} from "./auth/session"

function toInitials(fullName?: string): string {
  if (!fullName || !fullName.trim()) return "IT"
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (
    (parts[0][0] || "I") + (parts[parts.length - 1][0] || "T")
  ).toUpperCase()
}

function formatDateUi(iso?: string | null): string {
  if (!iso) return "30/12/2026"
  const d = iso.slice(0, 10)
  const parts = d.split("-")
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return iso
}

function parseNumericId(id?: string | number | null): number | null {
  if (typeof id === "number" && Number.isFinite(id)) return id
  if (!id) return null
  const str = String(id).trim()
  if (/^\d+$/.test(str)) return Number(str)
  const m = str.match(/^(?:job|pr|as|u|sk|ex|pf|cv)-(\d+)$/i)
  if (m) return Number(m[1])
  return null
}

const JOB_IMAGES = [
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=1000&h=560",
  "https://images.unsplash.com/photo-1587620962725-abab7fe55159?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=1000&h=560",
  "https://images.unsplash.com/photo-1607799279861-4dd421887fb3?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=1000&h=560",
  "https://images.unsplash.com/photo-1575089976121-8ed7b2a54265?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=1000&h=560",
]

function mapJobDtoToItem(job: Job | JobSummary, index = 0): JobItem {
  const labels: Record<string, string> = {
    DRAFT: "Bản nháp",
    OPEN: "Đang mở",
    ASSIGNED: "Đã giao",
    IN_PROGRESS: "Đang thực hiện",
    COMPLETED: "Đã hoàn thành",
    CLOSED: "Đã đóng",
    CANCELLED: "Đã hủy",
  }
  return {
    id: String(job.id),
    title: job.title,
    company: job.companyName || "",
    budget:
      money(job.budgetMin, job.currencyCode) +
      " – " +
      money(job.budgetMax, job.currencyCode),
    time: formatDateUi(job.createdAt),
    deadline: formatDateUi(job.deadline),
    status: labels[job.status],
    description: "description" in job ? job.description : "",
    skills: job.skills.map((s) => s.name),
    proposals: 0,
    image: JOB_IMAGES[index % JOB_IMAGES.length],
    createdAt: job.createdAt,
  }
}

function mapUserDtoToItem(u: UserDto): UserItem {
  const roleMap: Record<string, Role> = {
    FREELANCER: "Freelancer",
    CLIENT: "Client",
    ADMIN: "Admin",
  }
  return {
    id: String(u.id),
    name: u.fullName,
    email: u.email,
    phone: u.phone || u.phoneNumber || "090 123 4567",
    role: roleMap[u.role] || "Freelancer",
    initials: toInitials(u.fullName),
    joinedAt: formatDateUi(u.createdAt),
    status: u.status && u.status !== "ACTIVE" ? "Đã khóa" : "Đang hoạt động",
  }
}

export type Role = "Freelancer" | "Client" | "Admin"
type PublicPage = "home" | "jobs" | "talents" | "profile" | "about" | "contact" | "login" | "register"
type Theme = "light" | "dark"

export interface JobItem {
  id: string
  title: string
  company: string
  budget: string
  time: string
  deadline: string
  status: string
  description: string
  skills: string[]
  category?: string
  proposals: number
  image: string
  createdAt?: string
}

export interface ProposalItem {
  id: string
  jobId: string
  jobTitle?: string
  clientName?: string
  freelancerId?: string
  freelancerName?: string
  freelancerAvatarUrl?: string
  freelancerRole?: string
  freelancerBio?: string
  freelancerInitials?: string
  freelancerRating?: string
  freelancerJobs?: string
  freelancerSkills?: string[]
  cvId?: number | null
  cvFileUrl?: string | null
  cv: string
  price: string
  duration: string
  status: string
  statusKey: string
  cover: string
  createdAt?: string
}

export interface AssignmentItem {
  id: string
  code: string
  jobId: string
  title: string
  company: string
  freelancerName: string
  price: string
  period: string
  status: "Đang thực hiện" | "Đã hoàn thành" | "Đã hủy"
  description: string
  review: { rating: number ; comment: string } | null
  startDate?: string
  completedAt?: string | null
}

export interface TalentItem {
  id?: number
  avatarUrl?: string | null
  name: string
  role: string
  location: string
  hourlyRate: string
  rating: string
  jobs: string
  initials: string
  category: string
  bio: string
  skills: string[]
  portfolios: string[]
}

function publicTalent(f: PublicFreelancer): TalentItem {
  return {
    id: f.id,
    avatarUrl: f.avatarUrl,
    name: f.displayName,
    role: f.headline || "",
    location: "",
    hourlyRate: "",
    rating:
      f.averageRating != null && f.reviewCount > 0
        ? f.averageRating.toFixed(1)
        : "0/5",
    jobs: `${f.completedJobs ?? 0} dự án`,
    initials: toInitials(f.displayName),
    category: "",
    bio: f.bio || "",
    skills: f.skills,
    portfolios: [],
  }
}

export interface UserItem {
  id: string
  name: string
  email: string
  phone: string
  role: Role
  initials: string
  joinedAt: string
  status: "Đang hoạt động" | "Đã khóa"
}

export type AssignmentFilterTab = "Tất cả" | "Đang thực hiện" | "Đã hoàn thành" | "Đã hủy"
export type ProfileTab = "Thông tin cá nhân" | "Kỹ năng" | "Kinh nghiệm làm việc" | "Portfolio" | "CV" | "Đánh giá"

export interface ProfileReviewItem {
  id: string
  assignmentId: string
  jobTitle: string
  company: string
  rating: number
  comment: string
  createdAt: string
}

export interface FreelancerProfileData {
  completedJobs?: number
  name: string
  shortName: string
  initials: string
  title: string
  email: string
  phone: string
  bio: string
  avatarUrl?: string
  skills: {
    id: string
    title: string
    updatedAt: string
    proficiency?: number
    yearsExperience?: number | null
  }[]
  experiences: {
    id: string
    title: string
    updatedAt: string
    work?: WorkExperienceDto
  }[]
  portfolios: {
    id: string
    title: string
    updatedAt: string
    portfolio?: PortfolioDto
  }[]
  cvs: { id: string ; title: string ; updatedAt: string ; fileUrl?: string }[]
  reviews: ProfileReviewItem[]
  averageRating?: number
}

function createEmptyAuthenticatedProfile(meta?: {
  fullName?: string
  email?: string
  phone?: string
  title?: string
  bio?: string
  avatarUrl?: string | null
}): FreelancerProfileData {
  const fullName = (meta?.fullName || "Người dùng LinkIT").trim()
  const parts = fullName.split(/\s+/)
  return {
    name: fullName,
    shortName: parts.slice(-2).join(" "),
    initials: toInitials(fullName),
    title: meta?.title?.trim() || "",
    email: meta?.email || "",
    phone: meta?.phone || "",
    bio: meta?.bio || "",
    avatarUrl: meta?.avatarUrl || undefined,
    skills: [],
    experiences: [],
    portfolios: [],
    cvs: [],
    reviews: [],
    averageRating: 0,
  }
}

function getFreelancerReviews(
  profile: FreelancerProfileData,
  assignments: AssignmentItem[],
): ProfileReviewItem[] {
  const byAssignmentId = new Map<string, ProfileReviewItem>()
  for (const rev of profile.reviews || []) {
    const matchedAsg = assignments.find(
      (a) => String(a.id) === String(rev.assignmentId),
    )
    byAssignmentId.set(String(rev.assignmentId), {
      ...rev,
      jobTitle: matchedAsg?.title || rev.jobTitle,
      company: matchedAsg?.company || rev.company,
    })
  }
  for (const asg of assignments) {
    if (asg.review && !byAssignmentId.has(String(asg.id))) {
      byAssignmentId.set(String(asg.id), {
        id: `rev-asg-${asg.id}`,
        assignmentId: String(asg.id),
        jobTitle: asg.title,
        company: asg.company,
        rating: asg.review.rating,
        comment: asg.review.comment,
        createdAt: asg.period,
      })
    }
  }
  return Array.from(byAssignmentId.values())
}

const menus: Record<Role, string[]> = {
  Freelancer: [
    "Tổng quan",
    "Hồ sơ của tôi",
    "Tìm việc",
    "Việc làm đã lưu",
    "Đề xuất đã gửi",
    "Công việc của tôi",
    "Không gian dự án",
    "Hỗ trợ",
  ],
  Client: [
    "Tổng quan",
    "Quản lý công việc",
    "Không gian dự án",
    "Hồ sơ của tôi",
    "Hỗ trợ",
  ],
  Admin: adminPages,
}

interface AppStore {
  loggedIn: boolean

  role: Role
  jobs: JobItem[]
  clientJobs: JobItem[]
  proposals: ProposalItem[]
  assignments: AssignmentItem[]
  talents: TalentItem[]
  users: UserItem[]
  profile: FreelancerProfileData
  assignmentFilter: AssignmentFilterTab
  setAssignmentFilter: (filter: AssignmentFilterTab) => void
  jobFilterStatus: string
  setJobFilterStatus: (status: string) => void
  profileTab: ProfileTab
  setProfileTab: (tab: ProfileTab) => void
  selectedTalent: TalentItem
  setSelectedTalent: (t: TalentItem) => void
  navigateToDashboard: (page: string) => void
  openApplyModal: (job: JobItem) => void
  submitProposal: (
    jobId: string,
    cv: string,
    price: string,
    duration: string,
    cover: string,
  ) => Promise<boolean>
  withdrawProposal: (proposalId: string) => void
  acceptProposal: (
    jobId: string,
    proposalId: string,
    candidateName: string,
  ) => void
  rejectProposal: (proposalId: string) => void
  saveJob: (data: {
    id?: string
    title: string
    budget: string
    deadline: string
    skills: string[]
    description: string
  }) => Promise<boolean>
  closeJob: (jobId: string) => void
  completeAssignment: (assignmentId: string) => void
  cancelAssignment: (assignmentId: string) => void
  rateAssignment: (
    assignmentId: string,
    rating: number,
    comment: string,
  ) => void
  toggleUserLock: (userId: string) => void
  updateProfileInfo: (
    patch: Partial<FreelancerProfileData> & {
      newPassword?: string
      confirmPassword?: string
    },
  ) => Promise<boolean>
  uploadAvatarFile: (file: File) => Promise<boolean>
  uploadCvFile: (file: File) => Promise<{ id: string ; title: string } | null>
  openCvPreview: (
    cvId: string | number | null | undefined,
    fileName: string,
  ) => Promise<void>
  downloadCvFile: (
    cvId: string | number | null | undefined,
    fileName: string,
  ) => Promise<void>
  upsertProfileRecord: (
    tab: "Kỹ năng" | "Kinh nghiệm làm việc" | "Portfolio" | "CV",
    title: string,
    editId?: string,
    file?: File | null,
    skillDetails?: { proficiency: number ; yearsExperience: number },
    recordDetails?: { work?: WorkExperienceInput ; portfolio?: PortfolioInput },
  ) => Promise<boolean | void>
  deleteProfileRecord: (
    tab: "Kỹ năng" | "Kinh nghiệm làm việc" | "Portfolio" | "CV",
    id: string,
  ) => Promise<boolean>
  refreshJobs: () => Promise<void>
  refreshClientData: () => Promise<void>
  refreshFreelancerData: () => Promise<boolean>
  refreshAdminData: () => Promise<void>
  notify: (msg: string) => void
  savedJobIds: string[]
  toggleSaveJob: (jobId: string) => void
  savedJobRecords: SavedJobRecord[]
  savedJobsLoading: boolean
  savedJobsError: string
  savedJobsReady: boolean
  savedJobPendingIds: string[]
  refreshSavedJobs: () => void
  isJobSaved: (jobId: string) => boolean
  openChatWith: (partner: {
    name: string
    role?: string
    avatarUrl?: string | null
    jobId?: string
    jobTitle?: string
  }) => void
}

const StoreContext = createContext<AppStore>(null!)
const useStore = () => useContext(StoreContext)

function UserAvatar({
  avatarUrl,
  initials,
  alt = "",
  className = "talent-avatar",
  as = "div",
}: {
  avatarUrl?: string | null
  initials: string
  alt?: string
  className?: string
  as?: "div" | "span"
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const resolved = resolveAvatarUrl(avatarUrl)
  useEffect(() => {
    setImgFailed(false)
  }, [resolved])
  const Tag = as
  return (
    <Tag
      className={className}
      style={{ overflow: "hidden", position: "relative" }}
    >
      {resolved && !imgFailed ? (
        <img
          src={resolved}
          alt={alt}
          onError={() => setImgFailed(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            borderRadius: "inherit",
          }}
        />
      ) : (
        initials
      )}
    </Tag>
  )
}

const ALLOWED_AVATAR_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
])
const ALLOWED_AVATAR_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"])
const MAX_AVATAR_SIZE = 2 * 1024 * 1024

function AvatarUploadControl({
  wrapperClassName,
  buttonLabel,
  compact = false,
}: {
  wrapperClassName: string
  buttonLabel: string
  compact?: boolean
}) {
  const { profile, uploadAvatarFile, notify } = useStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [avatarError, setAvatarError] = useState("")

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleSelectFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    const ext = file.name.includes(".")
      ? file.name.split(".").pop()?.trim().toLowerCase() || ""
      : ""
    const mime = (file.type || "").toLowerCase()

    if (
      !ALLOWED_AVATAR_EXTENSIONS.has(ext) ||
      !ALLOWED_AVATAR_TYPES.has(mime)
    ) {
      const msg =
        "Định dạng ảnh không hợp lệ. Vui lòng chọn ảnh JPG, JPEG, PNG hoặc WEBP."
      setAvatarError(msg)
      notify(msg)
      return
    }

    if (file.size > MAX_AVATAR_SIZE) {
      const msg =
        "Dung lượng ảnh vượt quá giới hạn 2MB. Vui lòng chọn ảnh nhỏ hơn."
      setAvatarError(msg)
      notify(msg)
      return
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl)
    const nextPreview = URL.createObjectURL(file)
    setPendingFile(file)
    setPreviewUrl(nextPreview)
    setAvatarError("")
  }

  const handleCancelPreview = () => {
    if (uploading) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPendingFile(null)
    setPreviewUrl(null)
    setAvatarError("")
  }

  const handleConfirmUpload = async () => {
    if (!pendingFile || uploading) return
    setUploading(true)
    setAvatarError("")
    const ok = await uploadAvatarFile(pendingFile)
    setUploading(false)
    if (ok) {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPendingFile(null)
      setPreviewUrl(null)
    } else if (compact) {
      setAvatarError("Không thể lưu ảnh. Vui lòng thử lại.")
    }
  }

  const sizeLabel = pendingFile
    ? pendingFile.size >= 1024 * 1024
      ? `${(pendingFile.size / (1024 * 1024)).toFixed(2)} MB`
      : `${Math.max(1, Math.round(pendingFile.size / 1024))} KB`
    : ""

  return (
    <div
      className={wrapperClassName}
      style={
        compact
          ? undefined
          : {
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
              textAlign: "center",
            }
      }
    >
      <UserAvatar
        className={
          compact
            ? "talent-avatar client-profile-avatar-image"
            : "talent-avatar"
        }
        avatarUrl={previewUrl || profile.avatarUrl}
        initials={profile.initials}
        alt={profile.name}
      />
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={handleSelectFile}
      />
      <div
        className={compact ? "client-avatar-controls" : undefined}
        style={
          compact
            ? undefined
            : {
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                width: "100%",
              }
        }
      >
        {(!compact || !pendingFile) && (
          <button
            type="button"
            className="secondary-button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {pendingFile ? "Chọn ảnh khác" : buttonLabel}
          </button>
        )}
        {pendingFile && (
          <div
            className={compact ? "client-avatar-preview" : undefined}
            style={
              compact
                ? undefined
                : {
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "6px",
                    width: "100%",
                  }
            }
          >
            <button
              type="button"
              className="primary-button"
              disabled={uploading}
              onClick={handleConfirmUpload}
              style={
                compact
                  ? undefined
                  : { width: "100%", justifyContent: "center" }
              }
            >
              {compact
                ? uploading
                  ? "Đang lưu..."
                  : "Lưu ảnh"
                : uploading
                  ? "Đang tải ảnh lên..."
                  : "Xác nhận lưu ảnh"}
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={uploading}
              onClick={handleCancelPreview}
              style={
                compact
                  ? undefined
                  : { width: "100%", justifyContent: "center" }
              }
            >
              Hủy
            </button>
            <small
              style={{
                color: "#16a34a",
                fontWeight: 600,
                fontSize: "0.75rem",
                lineHeight: 1.35,
              }}
            >
              {compact
                ? "Đã chọn ảnh mới"
                : `${pendingFile.name} (${sizeLabel})`}
            </small>
          </div>
        )}
        {avatarError && (
          <small
            role="alert"
            style={{
              color: "#ef4444",
              fontWeight: 600,
              fontSize: "0.75rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
            }}
          >
            <AlertCircle size={13} /> {avatarError}
          </small>
        )}
      </div>
    </div>
  )
}

function Logo({
  className = "",
  light = false,
}: {
  className?: string
  light?: boolean
}) {
  return (
    <div
      className={`linkit-brand-logo-wrap ${
        light ? "light-mode-forced" : ""
      } ${className}`}
      aria-label="LinkIT"
    >
      <img
        src="/linkit-figma-exact.png"
        alt="LinkIT"
        className="linkit-logo-img logo-img-dark-text"
        loading="eager"
      />
      <img
        src="/linkit-figma-exact-light.png"
        alt="LinkIT"
        className="linkit-logo-img logo-img-light-text"
        loading="eager"
      />
    </div>
  )
}

function AccountMenu({
  role,
  onDashboard,
  onProfile,
  onSavedJobs,
  onSettings,
  onLogout,
}: {
  role: Role
  onDashboard: () => void
  onProfile: () => void
  onSavedJobs?: () => void
  onSettings: () => void
  onLogout: () => void
}) {
  const { profile, savedJobIds } = useStore()
  const [open, setOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 12 })
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const reposition = () => {
      const rect = ref.current?.getBoundingClientRect()
      if (!rect) return
      setMenuPosition({
        top: rect.bottom + 10,
        right: Math.max(12, window.innerWidth - rect.right),
      })
    }
    const close = (event: MouseEvent) => {
      const target = event.target as Node
      if (!ref.current?.contains(target) && !menuRef.current?.contains(target))
        setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    reposition()
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", onKeyDown)
    window.addEventListener("resize", reposition)
    window.addEventListener("scroll", reposition, true)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("resize", reposition)
      window.removeEventListener("scroll", reposition, true)
    }
  }, [open])

  return (
    <div className="account-wrap" ref={ref}>
      <button
        className="account-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(!open)}
      >
        <UserAvatar
          as="span"
          className="header-avatar"
          avatarUrl={profile.avatarUrl}
          initials={profile.initials}
          alt={profile.name}
        />
        <span>{profile.shortName}</span>
        <ChevronDown size={15} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="account-menu"
            role="menu"
            style={{
              position: "fixed",
              top: menuPosition.top,
              right: menuPosition.right,
              zIndex: 1000,
              width: "min(300px, calc(100vw - 24px))",
              maxHeight: "calc(100vh - 24px)",
              overflowY: "auto",
              transform: "none",
              filter: "none",
              backdropFilter: "none",
              WebkitBackdropFilter: "none",
            }}
          >
            <div>
              <strong>{profile.name}</strong>
              <span>{profile.email}</span>
              <b>{role}</b>
            </div>
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onDashboard()
              }}
            >
              <LayoutDashboard />
              Dashboard
            </button>
            {role === "Freelancer" && (
              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onSavedJobs?.()
                }}
              >
                <BookmarkCheck size={16} />
                Việc làm đã lưu ({savedJobIds.length})
              </button>
            )}
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onProfile()
              }}
            >
              <UserRound />
              Hồ sơ của tôi
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onSettings()
              }}
            >
              <Settings />
              Cài đặt tài khoản
            </button>
            <button
              role="menuitem"
              className="logout"
              onClick={() => {
                setOpen(false)
                onLogout()
              }}
            >
              <LogOut />
              Đăng xuất
            </button>
          </div>,
          document.body,
        )}
    </div>
  )
}

function NotificationButton({ role }: { role: Role }) {
  const { navigateToDashboard } = useStore()
  return (
    <NotificationBell
      user={getSessionSnapshot().user}
      navigate={navigateToDashboard}
    />
  )
}

function PublicHeader({
  page,
  go,
  loggedIn,
  role,
  openDashboard,
  logout,
  theme,
  toggleTheme,
}: {
  page: PublicPage
  go: (p: PublicPage) => void
  loggedIn: boolean
  role: Role
  openDashboard: (targetPage?: string) => void
  logout: () => void
  theme: Theme
  toggleTheme: () => void
}) {
  const { savedJobIds } = useStore()
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => setMenuOpen(false), [page])
  return (
    <header className={`public-header ${menuOpen ? "public-menu-open" : ""}`}>
      <button className="logo-button" onClick={() => go("home")}>
        <Logo />
      </button>
      <nav
        className="public-nav"
        id="public-navigation"
        aria-label="Điều hướng chính"
      >
        <button
          className={page === "home" ? "current" : ""}
          onClick={() => go("home")}
        >
          Trang chủ
        </button>
        <button
          className={page.includes("job") ? "current" : ""}
          onClick={() => go("jobs")}
        >
          Việc làm
        </button>
        <button
          className={page === "talents" || page === "profile" ? "current" : ""}
          onClick={() => go("talents")}
        >
          Freelancer
        </button>
        <button
          className={page === "about" ? "current" : ""}
          onClick={() => go("about")}
        >
          Về chúng tôi
        </button>
        <button
          className={page === "contact" ? "current" : ""}
          onClick={() => go("contact")}
        >
          Liên hệ
        </button>
      </nav>
      <div className="public-actions">
        <button
          type="button"
          className="icon-button header-saved-btn"
          onClick={() => {
            if (loggedIn && role === "Freelancer")
              openDashboard("Việc làm đã lưu")
            else go("jobs")
          }}
          title={`Việc làm đã lưu (${savedJobIds.length})`}
          aria-label={`Việc làm đã lưu (${savedJobIds.length})`}
        >
          <BookmarkCheck size={18} />
          {savedJobIds.length > 0 && (
            <span className="header-saved-counter">{savedJobIds.length}</span>
          )}
        </button>
        {loggedIn && <NotificationButton role={role} />}
        {!loggedIn && (
          <>
            <button className="login-link" onClick={() => go("login")}>
              Đăng nhập
            </button>
            <button className="primary-button" onClick={() => go("register")}>
              Đăng ký miễn phí
            </button>
          </>
        )}
        {loggedIn && (
          <AccountMenu
            role={role}
            onDashboard={() => openDashboard("Tổng quan")}
            onSavedJobs={() => openDashboard("Việc làm đã lưu")}
            onProfile={() =>
              openDashboard(
                role === "Admin" ? "Cài đặt tài khoản" : "Hồ sơ của tôi",
              )
            }
            onSettings={() => openDashboard("Cài đặt tài khoản")}
            onLogout={logout}
          />
        )}
        <button
          className="icon-button public-menu"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
          aria-controls="public-navigation"
          aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
    </header>
  )
}

function JobTitle({
  job,
  as = "h3",
  onOpen,
  previewEnabled = true,
}: {
  job: JobItem
  as?: "h2" | "h3"
  onOpen?: () => void
  previewEnabled?: boolean
}) {
  const Title = as
  const [preview, setPreview] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancel = (ref: typeof openTimer) => {
    if (ref.current) clearTimeout(ref.current)
    ref.current = null
  }
  const show = (element: HTMLElement) => {
    if (!previewEnabled || !window.matchMedia("(hover: hover)").matches) return
    cancel(closeTimer)
    cancel(openTimer)
    openTimer.current = setTimeout(() => {
      const rect = element.getBoundingClientRect()
      const width = Math.min(500, window.innerWidth - 32)
      const roomRight = window.innerWidth - rect.right - 18
      const left =
        roomRight >= width
          ? rect.right + 14
          : Math.max(16, rect.left - width - 14)
      const top = Math.max(
        16,
        Math.min(rect.top - 28, window.innerHeight - 550),
      )
      setPreview({ top, left, width })
    }, 250)
  }
  const hide = () => {
    cancel(openTimer)
    cancel(closeTimer)
    closeTimer.current = setTimeout(() => setPreview(null), 140)
  }
  useEffect(
    () => () => {
      cancel(openTimer)
      cancel(closeTimer)
    },
    [],
  )
  return (
    <div
      className="job-title-wrap"
      onMouseEnter={(e) => show(e.currentTarget)}
      onMouseLeave={hide}
    >
      <Title>{job.title}</Title>
      {preview &&
        createPortal(
          <div
            className="job-preview-popover"
            style={preview}
            onMouseEnter={() => cancel(closeTimer)}
            onMouseLeave={hide}
            role="tooltip"
          >
            <div className="job-preview-head">
              <div>
                <h3>{job.title}</h3>
                <p>{job.company}</p>
              </div>
              <b
                className={`status ${
                  job.status === "Đang mở"
                    ? "state-open"
                    : job.status === "Đã đóng"
                      ? "state-closed"
                      : "state-in_progress"
                }`}
              >
                {job.status}
              </b>
            </div>
            <div className="job-preview-facts">
              <span>
                <CircleDollarSign />
                {job.budget}
              </span>
              <span>
                <Clock3 />
                Hạn {job.deadline}
              </span>
            </div>
            <div className="skill-list">
              {job.skills.map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
            </div>
            <div className="job-preview-description">
              <h4>Mô tả công việc</h4>
              <RichDescription text={job.description} />
            </div>
            <button
              className="primary-button"
              onClick={(e) => {
                e.stopPropagation()
                setPreview(null)
                onOpen?.()
              }}
            >
              Xem chi tiết <ArrowRight size={16} />
            </button>
          </div>,
          document.body,
        )}
    </div>
  )
}

function JobCard({
  job,
  onOpen,
  compact = false,
  showcase = false,
}: {
  job: JobItem
  onOpen?: () => void
  compact?: boolean
  showcase?: boolean
}) {
  const { toggleSaveJob, isJobSaved } = useStore()
  const saved = isJobSaved(job.id)
  return (
    <article
      className={`job-card ${compact ? "compact" : ""} ${
        showcase ? "showcase-card" : ""
      }`}
      onClick={onOpen}
    >
      {showcase && (
        <div className={`project-thumbnail ${job.id}`}>
          <img
            src={job.image}
            alt={`Không gian phát triển ${job.title}`}
            loading="lazy"
          />
          <span>{job.skills[0]}</span>
        </div>
      )}
      <button
        type="button"
        className={`job-save-btn ${saved ? "saved" : ""}`}
        title={saved ? "Bỏ lưu việc làm" : "Lưu việc làm yêu thích"}
        onClick={(e) => {
          e.stopPropagation()
          toggleSaveJob(job.id)
        }}
      >
        {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
      </button>
      <div className="job-main">
        <div className="job-heading">
          <div>
            <JobTitle job={job} onOpen={onOpen} />
            <div className="job-company-line">
              <span className="company-logo" aria-hidden="true">
                {job.company?.trim().charAt(0).toUpperCase() || "C"}
              </span>
              <span className="job-company-name" title={job.company}>
                {job.company || "Chưa cập nhật công ty"}
              </span>
              <span className="job-company-verified">
                <ShieldCheck size={14} aria-hidden="true" />
                <span>Đã xác thực</span>
              </span>
            </div>
          </div>
          <b
            className={`status ${
              job.status === "Đang mở"
                ? "state-open"
                : job.status === "Đã đóng"
                  ? "state-closed"
                  : "state-in_progress"
            }`}
          >
            {job.status}
          </b>
        </div>
        <div className="job-meta">
          <span>
            <CircleDollarSign size={15} />
            {job.budget}
          </span>
          <span>
            <Clock3 size={15} />
            Hạn {job.deadline}
          </span>
          <span>
            <FileText size={15} />
            Đăng {job.time}
          </span>
        </div>
        <div className="skill-list">
          {job.skills.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
        {!compact && <p className="job-excerpt">{job.description}</p>}
      </div>
      {!compact && (
        <button className="apply-button" onClick={onOpen}>
          Xem chi tiết <ChevronRight size={15} />
        </button>
      )}
    </article>
  )
}

function Landing({
  go,
  openJob,
  onSearchJobs,
  onPostProject,
}: {
  go: (p: PublicPage) => void
  openJob: (id: string) => void
  onSearchJobs: (q: string) => void
  onPostProject: () => void
}) {
  const { setSelectedTalent } = useStore()
  const [publicJobs, setPublicJobs] = useState<JobItem[]>([])
  const [publicTalents, setPublicTalents] = useState<TalentItem[]>([])
  const [jobState, setJobState] = useState<"loading" | "ready" | "error">(
    "loading",
  )
  const [talentState, setTalentState] = useState<"loading" | "ready" | "error">(
    "loading",
  )
  useEffect(() => {
    let active = true
    jobApi
      .publicSearch({ page: 0, size: 6 })
      .then((data) => {
        if (active) {
          setPublicJobs(data.content.map(mapJobDtoToItem))
          setJobState("ready")
        }
      })
      .catch(() => {
        if (active) setJobState("error")
      })
    ;(async () => {
      const first = await publicFreelancersApi.list("", 0, 100)
      if (first.totalPages > 20)
        throw new Error("Danh sách Freelancer quá lớn để tải đầy đủ.")
      const all = [...first.content]
      for (let page = 1; page < first.totalPages; page++) {
        all.push(...(await publicFreelancersApi.list("", page, 100)).content)
      }
      if (active) {
        setPublicTalents(all.map(publicTalent))
        setTalentState("ready")
      }
    })().catch(() => {
      if (active) setTalentState("error")
    })
    return () => {
      active = false
    }
  }, [])
  const [liveStats, setLiveStats] = useState<MarketplaceStats | null>(null)
  const [statsState, setStatsState] = useState<"loading" | "ready" | "error">(
    "loading",
  )
  useEffect(() => {
    let active = true
    marketplaceStatsApi
      .get()
      .then((data) => {
        if (active) {
          setLiveStats(data)
          setStatsState("ready")
        }
      })
      .catch(() => {
        if (active) setStatsState("error")
      })
    return () => {
      active = false
    }
  }, [])
  const statCards = liveStats
    ? [
        [liveStats.freelancers, "Freelancer trên nền tảng"],
        [liveStats.jobs, "Công việc đã đăng"],
        [liveStats.completedJobs, "Dự án hoàn thành"],
        [liveStats.activeClients, "Client đang hoạt động"],
      ] as const
    : []
  const [heroQuery, setHeroQuery] = useState("")

  const topTalents = [...publicTalents]
    .sort((a, b) => {
      const score = (t: TalentItem) => {
        const n = Number(t.rating)
        return Number.isFinite(n) && n > 0 ? n : 0
      }
      return score(b) - score(a) || a.name.localeCompare(b.name, "vi")
    })
    .slice(0, 6)

  const trendingSkills = [
    "React",
    "Node.js",
    "Java",
    "Spring Boot",
    "Python",
    "Flutter",
    "UI/UX",
    "Data & AI",
  ]

  return (
    <div className="landing-home">
      {}
      <section className="hero topcv-hero">
        <div className="hero-content-wrapper">
          <div className="hero-badge">
            <ShieldCheck size={16} /> NỀN TẢNG TUYỂN DỤNG & FREELANCER IT HÀNG
            ĐẦU
          </div>
          <h1 className="hero-title">
            Tìm Kiếm Dự Án & Việc Làm IT <span>Chất Lượng Cao</span>
          </h1>
          <p className="hero-subtitle">
            Kết nối doanh nghiệp với Freelancer IT và các cơ hội dự án thực tế
            trên nền tảng.
          </p>

          {}
          <div className="topcv-search-container">
            <div className="topcv-search-bar">
              <div className="search-field">
                <Search size={20} className="search-icon" />
                <input
                  value={heroQuery}
                  onChange={(e) => setHeroQuery(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && onSearchJobs(heroQuery)
                  }
                  placeholder="Nhập kỹ năng, vị trí công việc (ví dụ: React, Java, Python, Mobile, UI/UX...)"
                />
              </div>
              <button
                className="search-submit-btn"
                onClick={() => onSearchJobs(heroQuery)}
              >
                <Search size={18} />
                <span>Tìm kiếm</span>
              </button>
            </div>

            {}
            <div className="trending-tags-row">
              <span className="trending-label">Kỹ năng phổ biến:</span>
              <div className="trending-tags">
                {trendingSkills.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    className="tag-pill"
                    onClick={() => {
                      setHeroQuery(skill)
                      onSearchJobs(skill)
                    }}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="hero-action-buttons">
            <button
              className="primary-button hero-cta-btn"
              onClick={() => onSearchJobs(heroQuery)}
            >
              Khám phá việc làm <ArrowRight size={16} />
            </button>
            <button
              className="secondary-button hero-cta-outline"
              onClick={onPostProject}
            >
              <BriefcaseBusiness size={16} /> Đăng tin tuyển dụng
            </button>
          </div>
        </div>

        {}
        <div className="hero-stats-banner">
          <p className="sample-data-label">
            {statsState === "ready"
              ? "Số liệu thực tế từ hệ thống"
              : statsState === "loading"
                ? "Đang tải số liệu..."
                : "Chưa thể tải số liệu"}
          </p>
          <div className="stats-grid-container">
            {statCards.map(([value, label]) => (
              <div key={label} className="stat-box">
                <div className="stat-number">
                  {value.toLocaleString("vi-VN")}
                </div>
                <div className="stat-title">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {}
      <section className="public-section featured-jobs-section">
        <SectionTitle
          kicker="CƠ HỘI VIỆC LÀM IT MỚI NHẤT"
          title="Dự án & Việc làm đang tuyển"
          text="Khám phá các cơ hội nghề nghiệp và dự án chất lượng được cập nhật liên tục mỗi ngày."
        />
        <div className="landing-jobs">
          {publicJobs.slice(0, 6).map((j) => (
            <JobCard showcase key={j.id} job={j} onOpen={() => openJob(j.id)} />
          ))}
          {jobState === "loading" && <p role="status">Đang tải việc làm...</p>}
          {jobState === "error" && (
            <p role="alert">Không thể tải việc làm. Vui lòng thử lại sau.</p>
          )}
          {jobState === "ready" && !publicJobs.length && (
            <p>Chưa có Job đang tuyển.</p>
          )}
        </div>
        <div className="section-footer-action">
          <button className="center-link-btn" onClick={() => go("jobs")}>
            Xem tất cả việc làm IT <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {}
      <section className="public-section soft-section featured-talents-section">
        <SectionTitle
          kicker="CHUYÊN GIA NỔI BẬT"
          title="Đội ngũ Freelancer IT hàng đầu"
          text="Hồ sơ được kiểm duyệt và năng lực được bảo chứng qua các dự án thực tế."
        />
        <div className="talent-grid">
          {topTalents.map((t) => (
            <TalentCard
              key={t.id ?? t.name}
              talent={t}
              onClick={() => {
                setSelectedTalent(t)
                go("profile")
              }}
            />
          ))}
          {talentState === "loading" && (
            <p role="status">Đang tải Freelancer...</p>
          )}
          {talentState === "error" && (
            <p role="alert">Không thể tải Freelancer. Vui lòng thử lại sau.</p>
          )}
          {talentState === "ready" && !publicTalents.length && (
            <p>Chưa có Freelancer công khai hồ sơ.</p>
          )}
        </div>
        <div className="section-footer-action">
          <button className="center-link-btn" onClick={() => go("talents")}>
            Khám phá thêm chuyên gia <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {}
      <section className="public-section categories-section">
        <SectionTitle
          kicker="LĨNH VỰC CÔNG NGHỆ"
          title="Tìm kiếm chuyên môn theo ngành"
          text="Đa dạng các lĩnh vực công nghệ từ lập trình, thiết kế đến dữ liệu và vận hành hệ thống."
        />
        <div className="category-grid">
          {[
            "Web Development",
            "Mobile App",
            "UI/UX Design",
            "Data & AI",
            "Cloud & DevOps",
            "Cyber Security",
          ].map((x) => (
            <div
              className="category-card"
              key={x}
              style={{ cursor: "pointer" }}
              onClick={() => go("talents")}
            >
              <div className="category-icon-wrap">
                <Code2 size={24} />
              </div>
              <div className="category-meta">
                <strong>{x}</strong>
                <span>
                  {liveStats
                    ? `${(liveStats.categories[x] ?? 0).toLocaleString("vi-VN")} chuyên gia & việc làm`
                    : statsState === "loading"
                      ? "Đang tải số liệu..."
                      : "Chưa có số liệu"}
                </span>
              </div>
              <ChevronRight size={18} className="category-arrow" />
            </div>
          ))}
        </div>
      </section>

      {}
      <section className="public-section process-section">
        <SectionTitle
          kicker="QUY TRÌNH HỢP TÁC"
          title="Bắt đầu dự án thật đơn giản"
          text="Ba bước chuẩn mực giúp Doanh nghiệp và Freelancer kết nối, triển khai hiệu quả."
        />
        <div className="process-grid">
          {[
            [
              "01",
              "Đăng tin dự án",
              "Mô tả chi tiết yêu cầu, phạm vi công việc, kỹ năng cần thiết và ngân sách dự kiến.",
            ],
            [
              "02",
              "Lựa chọn Freelancer",
              "Xem xét hồ sơ năng lực, đánh giá và các bản Proposal chất lượng từ các chuyên gia.",
            ],
            [
              "03",
              "Triển khai & Nghiệm thu",
              "Phối hợp nhịp nhàng, theo dõi tiến độ và nghiệm thu kết quả minh bạch trên nền tảng.",
            ],
          ].map((x) => (
            <div key={x[0]} className="process-card">
              <span className="process-step-num">{x[0]}</span>
              <h4>{x[1]}</h4>
              <p>{x[2]}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function SectionTitle({
  kicker,
  title,
  text,
}: {
  kicker: string
  title: string
  text: string
}) {
  return (
    <div className="section-title">
      <span>{kicker}</span>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  )
}

function TalentCard({
  talent: t,
  onClick,
}: {
  talent: TalentItem
  onClick: () => void
}) {
  return (
    <article className="talent-card panel" onClick={onClick}>
      <div className="talent-avatar">
        {t.avatarUrl ? (
          <img src={resolveAvatarUrl(t.avatarUrl)} alt={t.name} />
        ) : (
          t.initials
        )}
      </div>
      {t.id == null && <div className="available">Sẵn sàng làm việc</div>}
      <h3>{t.name}</h3>
      <p>{t.role}</p>
      <div
        className="talent-rating-row"
        aria-label={`Đánh giá ${
          t.rating === "0/5" || !Number(t.rating) ? "0/5" : t.rating + "/5"
        } · ${t.jobs || "0 dự án"}`}
      >
        <Star
          size={17}
          fill="currentColor"
          className="talent-rating-icon"
          aria-hidden="true"
        />
        <strong>
          {Number(t.rating) > 0 ? Number(t.rating).toFixed(1) : "0/5"}
        </strong>
        <span className="talent-rating-projects">· {t.jobs || "0 dự án"}</span>
      </div>
      <div className="skill-list">
        {t.skills.slice(0, 3).map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
      <div className="talent-card-actions" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="secondary-button talent-profile-button"
          onClick={onClick}
        >
          Xem hồ sơ <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </article>
  )
}

function PublicListing(props: {
  type: "jobs" | "talents"
  go: (p: PublicPage) => void
  loggedIn?: boolean
  requireLogin?: () => void
  selectedJobId?: string
  initialQuery?: string
}) {
  const {
    savedJobIds,
    toggleSaveJob,
    savedJobsLoading,
    savedJobsError,
    savedJobsReady,
    savedJobPendingIds,
    refreshSavedJobs,
  } = useStore()

  if (props.type === "talents") return <PublicFreelancerListing {...props} />
  return (
    <Jobs
      key={getSessionSnapshot().user?.id ?? "anonymous"}
      user={getSessionSnapshot().user}
      authPending={getSessionSnapshot().status === "loading"}
      onLogin={() => {
        props.requireLogin?.()
        props.go("login")
      }}
      initialId={parseNumericId(props.selectedJobId) ?? undefined}
      initialQuery={props.initialQuery}
      savedJobIds={savedJobIds}
      savedJobsLoading={savedJobsLoading}
      savedJobsError={savedJobsError}
      savedJobsReady={savedJobsReady}
      savedJobPendingIds={savedJobPendingIds}
      onRetrySavedJobs={refreshSavedJobs}
      onToggleSave={(id) => toggleSaveJob(String(id))}
      renderDescription={(text) => <RichDescription text={text} />}
    />
  )
}

function TalentCatalog({
  go,
  initialQuery = "",
  publicTalents,
}: {
  type: "jobs" | "talents"
  go: (p: PublicPage) => void
  loggedIn?: boolean
  requireLogin?: () => void
  selectedJobId?: string
  initialQuery?: string
  publicTalents: TalentItem[]
}) {
  const { setSelectedTalent } = useStore()
  const talents = publicTalents
  const [query, setQuery] = useState(initialQuery)
  const [category, setCategory] = useState("Tất cả")
  const [talentPage, setTalentPage] = useState(0)
  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])
  useEffect(() => {
    setTalentPage(0)
  }, [query, category, talents])
  const allTalents = talents
  const filteredTalents = allTalents.filter((t) => {
    const text = `${t.name} ${t.role} ${t.skills.join(" ")}`.toLowerCase()
    const matchQuery =
      !query.trim() || text.includes(query.trim().toLowerCase())
    const profileText = [t.role, ...t.skills].join(" ").toLocaleLowerCase("vi")
    const matches = (keywords: string[]) =>
      keywords.some((keyword) => profileText.includes(keyword))
    const matchCat =
      category === "Tất cả" ||
      (category === "Developer" &&
        matches([
          "developer",
          "lập trình",
          "software",
          "frontend",
          "front-end",
          "backend",
          "back-end",
          "fullstack",
          "full-stack",
          "web",
          "react",
          "angular",
          "vue",
          "node",
          "java",
          "spring",
          "javascript",
          "typescript",
          "php",
          ".net",
          "c#",
          "golang",
        ])) ||
      (category === "Mobile" &&
        matches([
          "mobile",
          "android",
          "ios",
          "flutter",
          "react native",
          "swift",
          "kotlin",
          "dart",
        ])) ||
      (category === "UI/UX" &&
        matches([
          "ui/ux",
          "ui ux",
          "ui designer",
          "ux designer",
          "product designer",
          "figma",
          "adobe xd",
          "thiết kế giao diện",
          "user experience",
          "user interface",
        ])) ||
      (category === "Data & AI" &&
        matches([
          "data",
          "ai",
          "machine learning",
          "deep learning",
          "artificial intelligence",
          "trí tuệ nhân tạo",
          "phân tích dữ liệu",
          "python",
          "pytorch",
          "tensorflow",
          "sql",
          "power bi",
          "tableau",
          "aws",
          "data engineer",
          "data scientist",
        ]))
    return matchQuery && matchCat
  })

  const sortedTalents = [...filteredTalents].sort((a, b) => {
    const score = (t: TalentItem) => {
      const n = Number(t.rating)
      return Number.isFinite(n) && n > 0 ? n : 0
    }
    return score(b) - score(a) || a.name.localeCompare(b.name, "vi")
  })
  const talentPageSize = 9
  const talentTotalPages = Math.ceil(sortedTalents.length / talentPageSize)
  const currentTalentPage = Math.min(
    talentPage,
    Math.max(0, talentTotalPages - 1),
  )
  const visibleTalents = sortedTalents.slice(
    currentTalentPage * talentPageSize,
    (currentTalentPage + 1) * talentPageSize,
  )
  return (
    <main className="listing-page">
      <div className="listing-head">
        <div>
          <span>CHUYÊN GIA ĐƯỢC XÁC THỰC</span>
          <h1>Chuyên gia IT hàng đầu</h1>
          <p>
            Kết nối trực tiếp với những tài năng công nghệ đã được chứng thực
            năng lực.
          </p>
        </div>
        <div className="listing-search">
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm chuyên gia theo tên, kỹ năng..."
          />
        </div>
      </div>
      <div className="filter-row">
        {["Tất cả", "Developer", "Mobile", "UI/UX", "Data & AI"].map((x) => (
          <button
            className={category === x ? "selected" : ""}
            onClick={() => setCategory(x)}
            key={x}
          >
            <Code2 size={14} />
            {x}
          </button>
        ))}
      </div>
      <div className="talent-grid listing-talents">
        {visibleTalents.map((t, i) => (
          <TalentCard
            key={t.id ?? i}
            talent={t}
            onClick={() => {
              setSelectedTalent(t)
              go("profile")
            }}
          />
        ))}
      </div>
      {talentTotalPages > 1 && (
        <nav className="talent-pagination" aria-label="Phân trang Freelancer">
          <button
            type="button"
            disabled={currentTalentPage === 0}
            onClick={() => setTalentPage((p) => Math.max(0, p - 1))}
          >
            Trước
          </button>
          <span>
            Trang {currentTalentPage + 1} / {talentTotalPages}
          </span>
          <button
            type="button"
            disabled={currentTalentPage >= talentTotalPages - 1}
            onClick={() =>
              setTalentPage((p) => Math.min(talentTotalPages - 1, p + 1))
            }
          >
            Tiếp
          </button>
        </nav>
      )}
    </main>
  )
}

function PublicFreelancerListing(props: {
  type: "jobs" | "talents"
  go: (p: PublicPage) => void
}) {
  const [items, setItems] = useState<TalentItem[]>([])
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")
  useEffect(() => {
    let active = true
    ;(async () => {
      const first = await publicFreelancersApi.list("", 0, 100)
      if (first.totalPages > 20)
        throw new Error("Danh sách Freelancer quá lớn để tải đầy đủ.")
      const all = [...first.content]
      for (let page = 1; page < first.totalPages; page++)
        all.push(...(await publicFreelancersApi.list("", page, 100)).content)
      if (active) {
        setItems(all.map(publicTalent))
        setState("ready")
      }
    })().catch(() => {
      if (active) setState("error")
    })
    return () => {
      active = false
    }
  }, [])
  if (state === "loading")
    return (
      <main className="listing-page" role="status">
        Đang tải Freelancer...
      </main>
    )
  if (state === "error")
    return (
      <main className="listing-page" role="alert">
        Không thể tải danh sách Freelancer. Vui lòng thử lại sau.
      </main>
    )
  if (!items.length)
    return (
      <main className="listing-page">Chưa có Freelancer công khai hồ sơ.</main>
    )
  return <TalentCatalog {...props} publicTalents={items} />
}

function JobModal({ job, close }: { job: JobItem ; close: () => void }) {
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
    }
    document.addEventListener("keydown", key)
    return () => document.removeEventListener("keydown", key)
  }, [close])

  const id = parseNumericId(job.id)
  return createPortal(
    <div className="modal-backdrop job-modal-backdrop" onMouseDown={close}>
      <div className="job-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="job-modal-close" aria-label="Đóng" onClick={close}>
          <X />
        </button>
        {id ? (
          <JobSnapshot
            id={id}
            renderDescription={(text) => <RichDescription text={text} />}
          />
        ) : (
          <p className="auth-error">Job không hợp lệ.</p>
        )}
      </div>
    </div>,
    document.body,
  )
}

function ProposalSubmitModal({
  job,
  close,
}: {
  job: JobItem
  close: () => void
}) {
  return <RealProposalModal id={Number(job.id)} close={close} />
}
function RealProposalModal({ id, close }: { id: number ; close: () => void }) {
  const { profile, uploadCvFile, notify } = useStore()
  const user = getSessionSnapshot().user
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  const eligible =
    !!job &&
    !!user &&
    job.status === "OPEN" &&
    job.clientId !== user.id &&
    user.roles.includes("FREELANCER")
  useEffect(() => {
    let alive = true
    setJob(null)
    setError("")
    jobApi
      .detail(id)
      .then((value) => {
        if (alive) setJob(value)
      })
      .catch((cause) => {
        if (alive)
          setError(
            cause instanceof Error ? cause.message : "Không thể tải Job.",
          )
      })
    return () => {
      alive = false
    }
  }, [id, retry])
  useEffect(() => {
    if (eligible) return
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
    }
    document.addEventListener("keydown", key)
    return () => document.removeEventListener("keydown", key)
  }, [eligible, close])
  if (eligible && job && user)
    return (
      <SubmitProposal
        key={job.id}
        job={job}
        user={user}
        initialOpen
        onDismiss={close}
        cvs={profile.cvs.map((cv) => ({ id: cv.id, title: cv.title }))}
        uploadCvFile={uploadCvFile}
        onSubmitted={(proposal) => {
          notify("Đã gửi Proposal #" + proposal.id + " thành công.")
          close()
        }}
      />
    )
  return createPortal(
    <div className="modal-backdrop">
      <section
        className="panel function-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Gửi Proposal ứng tuyển"
      >
        <button className="icon-button" aria-label="Đóng" onClick={close}>
          ×
        </button>
        <h2>Gửi Proposal ứng tuyển</h2>
        {error ? (
          <div className="auth-error" role="alert">
            {error}
            <button
              className="text-button"
              onClick={() => setRetry((value) => value + 1)}
            >
              Tải lại
            </button>
          </div>
        ) : !job ? (
          <p role="status">Đang tải Job...</p>
        ) : !user ? (
          <p>Vui lòng đăng nhập.</p>
        ) : (
          <p>Bạn không thể ứng tuyển Job này.</p>
        )}
      </section>
    </div>,
    document.body,
  )
}

function DashboardJobSearch(props: {
  query: string
  onQueryChange: (value: string) => void
}) {
  const {
    notify,
    savedJobIds,
    toggleSaveJob,
    savedJobsLoading,
    savedJobsError,
    savedJobsReady,
    savedJobPendingIds,
    refreshSavedJobs,
  } = useStore()
  const rawId = new URLSearchParams(
    window.location.hash.split("?")[1] || "",
  ).get("jobId")
  const initialId =
    rawId && /^[1-9]\d*$/.test(rawId) && Number.isSafeInteger(Number(rawId))
      ? Number(rawId)
      : undefined

  return (
    <Jobs
      key={getSessionSnapshot().user?.id ?? "anonymous"}
      user={getSessionSnapshot().user}
      authPending={getSessionSnapshot().status === "loading"}
      onLogin={() => notify("Vui lòng đăng nhập.")}
      initialQuery={props.query}
      initialId={initialId}
      savedJobIds={savedJobIds}
      savedJobsLoading={savedJobsLoading}
      savedJobsError={savedJobsError}
      savedJobsReady={savedJobsReady}
      savedJobPendingIds={savedJobPendingIds}
      onRetrySavedJobs={refreshSavedJobs}
      onToggleSave={(id) => toggleSaveJob(String(id))}
      renderDescription={(text) => <RichDescription text={text} />}
    />
  )
}

function SavedJobsManager({
  navigateDashboard,
}: {
  navigateDashboard?: (page: string) => void
}) {
  const {
    savedJobIds,
    savedJobRecords,
    savedJobsLoading,
    savedJobsError,
    savedJobsReady,
    savedJobPendingIds,
    refreshSavedJobs,
    toggleSaveJob,

    openApplyModal,
    proposals,
  } = useStore()
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const saved = savedJobRecords.flatMap((record) =>
    record.job
      ? [
          {
            job: mapJobDtoToItem(record.job),
            publishedAt: record.publishedAt,
          },
        ]
      : [],
  )
  const unavailable = savedJobRecords.filter((record) => !record.job)
  const filtered = saved.filter(({ job }) => {
    const text = [job.title, job.company, ...job.skills]
      .join(" ")
      .toLocaleLowerCase("vi")
    return (
      text.includes(query.trim().toLocaleLowerCase("vi")) &&
      (!statusFilter || job.status === statusFilter)
    )
  })
  const statuses = Array.from(new Set(saved.map(({ job }) => job.status)))
  const discover = () => navigateDashboard?.("Tìm việc")
  const openJob = (job: JobItem) => {
    navigateDashboard?.("Tìm việc")
    window.history.pushState(
      null,
      "",
      "#/dashboard/" +
        encodeURIComponent("Tìm việc") +
        "?jobId=" +
        encodeURIComponent(job.id),
    )
    window.dispatchEvent(new PopStateEvent("popstate"))
  }
  const loading = savedJobsLoading
  const ready = savedJobsReady

  return (
    <section
      className="saved-jobs-manager saved-jobs-premium"
      aria-label="Việc làm đã lưu"
      aria-busy={loading}
    >
      <div className="saved-page-heading">
        <div>
          <div className="saved-heading-title">
            <h1>Việc làm đã lưu</h1>
            <span
              className="saved-count"
              aria-label={savedJobIds.length + " việc làm"}
            >
              {savedJobIds.length}
            </span>
          </div>
          <p>Những cơ hội bạn muốn quay lại.</p>
        </div>
        <button type="button" className="primary-button" onClick={discover}>
          <Search size={16} />
          Khám phá việc làm
        </button>
      </div>
      {savedJobsError && (
        <div className="saved-feedback" role="alert">
          <AlertCircle size={17} />
          <span>{savedJobsError}</span>
          <button
            type="button"
            className="text-button"
            disabled={loading || savedJobPendingIds.length > 0}
            onClick={refreshSavedJobs}
          >
            Thử lại
          </button>
        </div>
      )}
      {savedJobIds.length > 0 && (
        <div className="saved-toolbar">
          <div className="saved-query">
            <Search size={17} />
            <input
              type="search"
              aria-label="Tìm việc đã lưu"
              placeholder="Tìm tên việc, Client, kỹ năng…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button
                type="button"
                aria-label="Xóa tìm kiếm"
                onClick={() => setQuery("")}
              >
                <X size={15} />
              </button>
            )}
          </div>
          <select
            aria-label="Lọc trạng thái tuyển dụng"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      )}
      {loading && (
        <div className="saved-loading" role="status">
          <LoaderCircle size={18} className="spin" />
          Đang cập nhật việc đã lưu…
        </div>
      )}
      {ready && savedJobIds.length === 0 ? (
        <div className="saved-page-empty">
          <div className="saved-empty-symbol">
            <Bookmark size={28} strokeWidth={1.6} />
          </div>
          <h2>Chưa có việc làm nào được lưu</h2>
          <p>Lưu những công việc bạn quan tâm để dễ dàng tìm lại.</p>
          <button type="button" className="primary-button" onClick={discover}>
            Khám phá việc làm
            <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <div className="saved-rows">
          {filtered.map(({ job, publishedAt }) => {
            const pending = savedJobPendingIds.includes(job.id)
            const applied = proposals.some(
              (proposal) =>
                String(proposal.jobId) === job.id &&
                proposal.statusKey !== "withdrawn",
            )
            return (
              <article key={job.id} className="saved-row" aria-busy={pending}>
                <div className="saved-row-avatar" aria-hidden="true">
                  {toInitials(job.company)}
                </div>
                <div className="saved-row-main">
                  <div className="saved-row-title">
                    <h2>{job.title}</h2>
                    <span
                      className={
                        "status " +
                        (job.status === "Đang mở"
                          ? "state-open"
                          : "state-closed")
                      }
                    >
                      {job.status}
                    </span>
                  </div>
                  <p className="saved-row-client">
                    {job.company || "Client"}
                    {publishedAt && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <time dateTime={publishedAt}>
                          Đăng {formatDateUi(publishedAt)}
                        </time>
                      </>
                    )}
                  </p>
                  <div className="saved-row-budget">
                    <CircleDollarSign size={15} />
                    <span>{job.budget}</span>
                  </div>
                  {job.skills.length > 0 && (
                    <div className="skill-list">
                      {job.skills.map((skill) => (
                        <span key={skill}>{skill}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="saved-row-actions">
                  <button
                    type="button"
                    className="saved-bookmark"
                    title="Bỏ lưu"
                    aria-label={"Bỏ lưu " + job.title}
                    aria-pressed="true"
                    disabled={pending || loading}
                    onClick={() => void toggleSaveJob(job.id)}
                  >
                    {pending ? (
                      <LoaderCircle size={18} className="spin" />
                    ) : (
                      <Bookmark size={18} fill="currentColor" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => openJob(job)}
                  >
                    Xem chi tiết
                    <ArrowRight size={14} />
                  </button>
                  {applied ? (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => navigateDashboard?.("Đề xuất đã gửi")}
                    >
                      Xem Proposal
                    </button>
                  ) : (
                    job.status === "Đang mở" && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => openApplyModal(job)}
                      >
                        Gửi Proposal
                      </button>
                    )
                  )}
                </div>
              </article>
            )
          })}
          {unavailable.map((record) => (
            <article
              className="saved-row saved-row-unavailable"
              key={record.jobId}
            >
              <div className="saved-row-avatar">
                <Bookmark size={19} />
              </div>
              <div className="saved-row-main">
                <h2>Job #{record.jobId} không còn khả dụng</h2>
                <p>Thông tin công việc hiện không được công khai.</p>
              </div>
              <button
                type="button"
                className="secondary-button"
                disabled={
                  loading || savedJobPendingIds.includes(String(record.jobId))
                }
                onClick={() => void toggleSaveJob(String(record.jobId))}
              >
                Bỏ lưu
              </button>
            </article>
          ))}
          {ready &&
            savedJobIds.length > 0 &&
            filtered.length === 0 &&
            unavailable.length === 0 && (
              <div className="saved-page-empty saved-filter-empty">
                <Search size={26} />
                <h2>Không tìm thấy việc phù hợp</h2>
                <p>Thử từ khóa hoặc trạng thái khác.</p>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setQuery("")
                    setStatusFilter("")
                  }}
                >
                  Xóa bộ lọc
                </button>
              </div>
            )}
        </div>
      )}
    </section>
  )
}

function AboutPage({ contact }: { contact?: boolean }) {
  const { notify } = useStore()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const canSubmitContact = Boolean(
    name.trim() && email.trim() && subject.trim() && message.trim(),
  )
  const [sendingContact, setSendingContact] = useState(false)
  const [contactResult, setContactResult] = useState("")
  const handleSendContact = async () => {
    if (!canSubmitContact || sendingContact) {
      notify("Vui lòng điền đầy đủ thông tin liên hệ.")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      notify("Email không hợp lệ.")
      return
    }
    setSendingContact(true)
    setContactResult("")
    try {
      await supportApi.submit({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
      })
      setName("")
      setEmail("")
      setSubject("")
      setMessage("")
      setContactResult("Yêu cầu đã được gửi đến Admin. Cảm ơn bạn đã liên hệ!")
      notify("Đã gửi yêu cầu hỗ trợ đến Admin.")
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Không thể gửi yêu cầu. Vui lòng thử lại.",
      )
    } finally {
      setSendingContact(false)
    }
  }
  if (contact)
    return (
      <main className="contact-page">
        <SectionTitle
          kicker="LIÊN HỆ"
          title="Chúng tôi sẵn sàng hỗ trợ"
          text="Gửi yêu cầu hỗ trợ trực tiếp đến đội ngũ quản trị LinkIT."
        />
        <div className="contact-grid">
          <section className="panel">
            <h2>Gửi lời nhắn</h2>
            <div className="form-grid">
              <label>
                Họ và tên *
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                />
              </label>
              <label>
                Email *
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </label>
              <label className="full">
                Chủ đề *
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Bạn cần hỗ trợ về nội dung gì?"
                />
              </label>
              <label className="full">
                Nội dung *
                <textarea
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Mô tả chi tiết câu hỏi của bạn..."
                />
              </label>
            </div>
            <button
              className="primary-button"
              disabled={!canSubmitContact || sendingContact}
              onClick={() => void handleSendContact()}
            >
              {sendingContact ? "Đang gửi..." : "Gửi yêu cầu"}
            </button>
            {contactResult && <p role="status">{contactResult}</p>}
          </section>
          <aside className="panel contact-info">
            <div className="contact-info-mark">
              <Mail size={21} />
            </div>
            <div>
              <h2>Yêu cầu được gửi đến Admin</h2>
              <p>
                Sau khi gửi thành công, yêu cầu sẽ được lưu trong hệ thống để bộ
                phận quản trị LinkIT tiếp nhận và xử lý.
              </p>
            </div>
            <span className="contact-info-note">
              Vui lòng nhập email chính xác để Admin có thể phản hồi.
            </span>
          </aside>
        </div>
      </main>
    )
  return (
    <main className="about-page">
      <section className="about-hero">
        <div>
          <div className="about-brand">
            <Logo className="about-official-logo" />
            <p>Kết nối. Hợp tác. Sáng tạo.</p>
          </div>
          <h1>Kết nối tài năng công nghệ với những ý tưởng xứng tầm</h1>
          <p>
            Linkit là nền tảng giúp Freelancer IT và Client tìm thấy nhau, cộng
            tác minh bạch và tạo ra những sản phẩm công nghệ có giá trị.
          </p>
        </div>
        <img
          src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
          alt="Đội ngũ công nghệ cùng cộng tác"
        />
      </section>
      <section className="about-values">
        <div>
          <span>SỨ MỆNH</span>
          <h2>Trao cơ hội đúng người, đúng dự án</h2>
          <p>
            Đơn giản hóa quá trình tìm kiếm, lựa chọn và cộng tác giữa chuyên
            gia IT với doanh nghiệp.
          </p>
        </div>
        <div>
          <span>TẦM NHÌN</span>
          <h2>Một thị trường nhân lực IT đáng tin cậy</h2>
          <p>
            Xây dựng môi trường nơi năng lực được ghi nhận bằng hồ sơ, dự án và
            đánh giá thực tế.
          </p>
        </div>
      </section>
      <section className="public-section">
        <SectionTitle
          kicker="GIÁ TRỊ CỐT LÕI"
          title="Nguyên tắc chúng tôi theo đuổi"
          text="Mọi quyết định sản phẩm đều bắt đầu từ sự tin cậy."
        />
        <div className="about-value-grid">
          {[
            {
              title: "Minh bạch",
              desc: "Phạm vi công việc, ngân sách và tiến độ được thể hiện rõ ràng.",
              icon: ShieldCheck,
            },
            {
              title: "Tin cậy",
              desc: "Hồ sơ năng lực và đánh giá giúp các bên đưa ra lựa chọn có cơ sở.",
              icon: CheckCircle2,
            },
            {
              title: "Hợp tác",
              desc: "Client và Freelancer phối hợp qua từng cột mốc của dự án.",
              icon: UsersRound,
            },
            {
              title: "Chuyên nghiệp",
              desc: "Quy trình thống nhất từ đề xuất, bàn giao đến nghiệm thu.",
              icon: BriefcaseBusiness,
            },
          ].map(({ title, desc, icon: Icon }, index) => (
            <article className="about-value-card" key={title}>
              <div className="about-value-card-top">
                <span className="about-value-icon">
                  <Icon size={23} strokeWidth={1.9} />
                </span>
                <span className="about-value-index">0{index + 1}</span>
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="team-section">
        <img
          src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
          alt="Nhóm phát triển sản phẩm họp bàn"
        />
        <div>
          <span>ĐỘI NGŨ PHÁT TRIỂN</span>
          <h2>Được xây dựng bởi những người tin vào sức mạnh cộng tác</h2>
          <p>
            Thông tin thành viên đội ngũ đang được cập nhật. Khu vực này dành
            cho nhóm dự án bổ sung hồ sơ chính thức.
          </p>
        </div>
      </section>
      <section className="about-process">
        <SectionTitle
          kicker="CÁCH HOẠT ĐỘNG"
          title="Từ ý tưởng đến sản phẩm hoàn thiện"
          text="Một hành trình cộng tác có cấu trúc, rõ trách nhiệm ở từng giai đoạn."
        />
        <div className="about-process-steps">
          {[
            {
              n: "01",
              title: "Đăng dự án",
              text: "Client mô tả yêu cầu, kỹ năng và ngân sách.",
            },
            {
              n: "02",
              title: "Chọn cộng sự",
              text: "Freelancer gửi đề xuất; Client đánh giá và lựa chọn.",
            },
            {
              n: "03",
              title: "Cộng tác",
              text: "Hai bên thống nhất phạm vi và theo dõi các cột mốc.",
            },
            {
              n: "04",
              title: "Hoàn thành",
              text: "Nghiệm thu sản phẩm và đánh giá hợp tác.",
            },
          ].map((step) => (
            <div className="about-process-step" key={step.n}>
              <span>{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

function PublicFreelancerDetail({ go }: { go: (p: PublicPage) => void }) {
  const {
    selectedTalent,
    setSelectedTalent,
    loggedIn,
    role,
    navigateToDashboard,
    notify,
  } = useStore()
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")
  const [experience, setExperience] = useState<number | null>(null)
  const [publicHistory, setPublicHistory] = useState<{
    workExperiences: PublicFreelancer["workExperiences"]
    portfolioProjects: PublicFreelancer["portfolioProjects"]
  }>({ workExperiences: [], portfolioProjects: [] })
  const [publicHistorySupported, setPublicHistorySupported] = useState(true)
  useEffect(() => {
    if (!selectedTalent.id) {
      setState("error")
      return
    }
    const talentId = selectedTalent.id
    let active = true
    setState("loading")
    publicFreelancersApi
      .detail(Number(talentId))
      .then((item) => {
        if (active) {
          setSelectedTalent(publicTalent(item))
          setExperience(item.yearsExperience ?? null)
          setPublicHistory({
            workExperiences: item.workExperiences ?? [],
            portfolioProjects: item.portfolioProjects ?? [],
          })
          setPublicHistorySupported(
            Array.isArray(item.workExperiences) &&
              Array.isArray(item.portfolioProjects),
          )
          setState("ready")
        }
      })
      .catch((err) => {
        if (active) {
          setState("error")
          console.error("Không tải được hồ sơ Freelancer:", err)
        }
      })
    return () => {
      active = false
    }
  }, [selectedTalent.id])
  if (state === "loading")
    return (
      <main className="detail-page public-talent-detail" role="status">
        Đang tải hồ sơ...
      </main>
    )
  if (state === "error")
    return (
      <main className="detail-page public-talent-detail" role="alert">
        <p>
          Không thể tải hồ sơ Freelancer. Hồ sơ có thể không còn công khai hoặc
          đường dẫn thiếu ID.
        </p>
        <button
          type="button"
          className="secondary-button"
          onClick={() => go("talents")}
        >
          Quay lại danh sách Freelancer
        </button>
      </main>
    )
  const rating = Number(selectedTalent.rating)
  const hasRating = Number.isFinite(rating) && rating > 0
  const contact = () => {
    if (!loggedIn) {
      go("login")
      return
    }
    if (role === "Client") {
      navigateToDashboard("Quản lý công việc")
      notify(
        "Bạn có thể xem công việc và đề xuất của Freelancer trong khu vực Client.",
      )
      return
    }
    notify(
      role === "Admin"
        ? "Đây là hồ sơ công khai. Hãy sử dụng các chức năng quản trị để quản lý tài khoản."
        : "Để liên hệ Freelancer, vui lòng sử dụng tài khoản Client.",
    )
  }
  return (
    <main className="detail-page public-talent-detail">
      <button type="button" className="back-link" onClick={() => go("talents")}>
        ← Quay lại danh sách chuyên gia
      </button>
      <div className="public-talent-layout">
        <section className="public-talent-content">
          <div className="public-talent-hero">
            <div className="public-talent-avatar talent-avatar">
              {selectedTalent.avatarUrl ? (
                <img
                  src={resolveAvatarUrl(selectedTalent.avatarUrl)}
                  alt={selectedTalent.name}
                />
              ) : (
                selectedTalent.initials
              )}
            </div>
            <div className="public-talent-heading">
              <span className="public-talent-eyebrow">
                HỒ SƠ FREELANCER CÔNG KHAI
              </span>
              <h1>{selectedTalent.name}</h1>
              <p>{selectedTalent.role || "Chuyên gia công nghệ thông tin"}</p>
              <div className="public-talent-rating">
                <Star size={17} fill="currentColor" aria-hidden="true" />
                <strong>{hasRating ? rating.toFixed(1) : "0/5"}</strong>
                <span>· {selectedTalent.jobs || "0 dự án"}</span>
              </div>
            </div>
          </div>
          <section className="public-talent-section">
            <div className="public-talent-section-title">
              <UserRound size={19} aria-hidden="true" />
              <h2>Giới thiệu bản thân</h2>
            </div>
            <p>
              {selectedTalent.bio?.trim() ||
                "Freelancer chưa cập nhật phần giới thiệu công khai."}
            </p>
          </section>
          <section className="public-talent-section">
            <div className="public-talent-section-title">
              <Code2 size={19} aria-hidden="true" />
              <h2>Kỹ năng chuyên môn</h2>
            </div>
            {normalizePublicSkills(selectedTalent.skills).length ? (
              <div className="skill-list big">
                {normalizePublicSkills(selectedTalent.skills).map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
            ) : (
              <p>Chưa cập nhật kỹ năng công khai.</p>
            )}
          </section>
          <section className="public-talent-section">
            <div className="public-talent-section-title">
              <BriefcaseBusiness size={19} aria-hidden="true" />
              <h2>Kinh nghiệm làm việc</h2>
            </div>
            {(publicHistory.workExperiences ?? []).length ? (
              <div className="public-talent-history">
                {[...(publicHistory.workExperiences ?? [])]
                  .sort((a, b) =>
                    (b.startDate || "").localeCompare(a.startDate || ""),
                  )
                  .map((item) => (
                    <article
                      className="public-talent-history-item"
                      key={item.id}
                    >
                      <strong>
                        {item.position} · {item.companyName}
                      </strong>
                      <span>
                        {item.startDate || "Chưa rõ"} –{" "}
                        {item.isCurrent
                          ? "Hiện tại"
                          : item.endDate || "Chưa rõ"}
                      </span>
                      {item.description && <p>{item.description}</p>}
                      {item.achievements && (
                        <p>
                          <strong>Thành tựu:</strong> {item.achievements}
                        </p>
                      )}
                    </article>
                  ))}
              </div>
            ) : (
              <p>
                {publicHistorySupported
                  ? "Chưa có kinh nghiệm làm việc trong hồ sơ công khai."
                  : "Máy chủ chưa trả dữ liệu kinh nghiệm làm việc. Cần cập nhật và khởi động lại backend LinkIT."}
              </p>
            )}
          </section>
          <section className="public-talent-section">
            <div className="public-talent-section-title">
              <FolderKanban size={19} aria-hidden="true" />
              <h2>Portfolio · Dự án nổi bật</h2>
            </div>
            {(publicHistory.portfolioProjects ?? []).length ? (
              <div className="public-talent-history">
                {(publicHistory.portfolioProjects ?? []).map((item) => (
                  <article className="public-talent-history-item" key={item.id}>
                    <strong>{item.title}</strong>
                    {item.role && <span>{item.role}</span>}
                    {item.description && <p>{item.description}</p>}
                    {item.technologies && (
                      <div className="skill-list">
                        {normalizePublicSkills(
                          item.technologies.split(/[,;]+/),
                        ).map((skill) => (
                          <span key={skill}>{skill}</span>
                        ))}
                      </div>
                    )}
                    {item.projectUrl?.startsWith("https://") && (
                      <a
                        href={item.projectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Xem dự án
                      </a>
                    )}
                    {item.githubUrl?.startsWith("https://") && (
                      <a
                        href={item.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        GitHub
                      </a>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p>
                {publicHistorySupported
                  ? "Chưa có dự án Portfolio trong hồ sơ công khai."
                  : "Máy chủ chưa trả dữ liệu Portfolio. Cần cập nhật và khởi động lại backend LinkIT."}
              </p>
            )}
          </section>
        </section>
        <aside className="public-talent-aside">
          <div className="public-talent-summary">
            <h2>Tổng quan năng lực</h2>
            <div className="public-talent-stat">
              <span>Dự án hoàn thành</span>
              <strong>{selectedTalent.jobs || "0 dự án"}</strong>
            </div>
            <div className="public-talent-stat">
              <span>Đánh giá trung bình</span>
              <strong className="public-talent-stat-rating">
                <Star size={17} fill="currentColor" aria-hidden="true" />{" "}
                {hasRating ? rating.toFixed(1) + "/5" : "0/5"}
              </strong>
            </div>
            {experience !== null && (
              <div className="public-talent-stat">
                <span>Kinh nghiệm</span>
                <strong>{experience} năm</strong>
              </div>
            )}
            <button
              type="button"
              className="primary-button public-talent-cta"
              onClick={contact}
            >
              {!loggedIn
                ? "Đăng nhập để liên hệ"
                : role === "Client"
                  ? "Đến khu vực Client"
                  : "Xem quyền liên hệ"}{" "}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
            <p className="public-talent-privacy">
              Chỉ hiển thị thông tin Freelancer đã cho phép công khai.
            </p>
          </div>
        </aside>
      </div>
    </main>
  )
}

function PasswordResetPage({
  initialEmail,
  back,
}: {
  initialEmail: string
  back: () => void
}) {
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [step, setStep] = useState<"request" | "confirm" | "done">("request")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const requestCode = async () => {
    if (busy) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Email không hợp lệ.")
      return
    }
    setBusy(true)
    setError("")
    try {
      const result = await authApi.requestPasswordCode(email.trim())
      setNotice(result.message)
      setStep("confirm")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể gửi mã.")
    } finally {
      setBusy(false)
    }
  }
  const confirm = async () => {
    if (busy) return
    const invalid = passwordError(newPassword)
    if (!/^\d{6}$/.test(code)) {
      setError("Nhập mã gồm 6 chữ số.")
      return
    }
    if (invalid) {
      setError(invalid)
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Hai mật khẩu không khớp.")
      return
    }
    setBusy(true)
    setError("")
    try {
      const result = await authApi.resetPassword(
        email.trim(),
        code,
        newPassword,
      )
      setNotice(result.message)
      setStep("done")
      setNewPassword("")
      setConfirmPassword("")
      setCode("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể đổi mật khẩu.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-card panel login-card password-reset-card">
        <div className="auth-brand">
          <Logo />
          <p>Bảo mật tài khoản LinkIT</p>
        </div>
        <div className="auth-header-text">
          <h1>
            {step === "done" ? "Đổi mật khẩu thành công" : "Quên mật khẩu?"}
          </h1>
          <p>
            {step === "request"
              ? "Nhập email đăng ký để nhận mã xác minh gồm 6 chữ số."
              : step === "confirm"
                ? "Kiểm tra hộp thư và nhập mã trong vòng 10 phút."
                : "Bạn có thể đăng nhập bằng mật khẩu mới."}
          </p>
        </div>
        {step !== "done" && (
          <div className="auth-form-stack">
            <label>
              Địa chỉ email
              <input
                type="email"
                autoComplete="email"
                value={email}
                disabled={busy || step === "confirm"}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ban@gmail.com"
              />
            </label>
            {step === "confirm" && (
              <>
                <label>
                  Mã xác minh
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="Nhập 6 chữ số"
                  />
                </label>
                <label>
                  Mật khẩu mới
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Từ 12–72 ký tự"
                  />
                </label>
                <label>
                  Xác nhận mật khẩu mới
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu"
                  />
                </label>
              </>
            )}
          </div>
        )}
        {notice && (
          <p role="status" className="password-reset-notice">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="auth-error">
            <AlertCircle size={15} />
            {error}
          </p>
        )}
        {step !== "done" && (
          <button
            type="button"
            className="primary-button auth-submit"
            disabled={busy}
            onClick={() =>
              void (step === "request" ? requestCode() : confirm())
            }
          >
            {busy
              ? "Đang xử lý..."
              : step === "request"
                ? "Gửi mã về email"
                : "Đổi mật khẩu"}
          </button>
        )}
        {step === "confirm" && (
          <button
            type="button"
            className="password-reset-secondary"
            disabled={busy}
            onClick={() => {
              setStep("request")
              setNotice("")
              setCode("")
            }}
          >
            Đổi email hoặc gửi lại mã
          </button>
        )}
        <button
          type="button"
          className="password-reset-secondary"
          onClick={back}
        >
          Quay lại đăng nhập
        </button>
      </section>
    </main>
  )
}

function AuthPage({
  register,
  go,
  openDashboard,
}: {
  register?: boolean
  go: (p: PublicPage) => void
  openDashboard: (user: AuthUser) => void
}) {
  const { notify } = useStore()
  const [resetMode, setResetMode] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role>("Freelancer")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [emailError, setEmailError] = useState("")
  const [emailSuggestion, setEmailSuggestion] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  useEffect(() => {
    setError("")
    setEmailError("")
    setEmailSuggestion("")
  }, [register])
  const validEmail = (value: string) =>
    value.length <= 254 && /^[^\s@]+@[^\s@]+$/.test(value)
  const handleEmailChange = (value: string) => {
    setEmail(value)
    setEmailError("")
    setError("")
  }
  const handleEmailBlur = () => {
    if (email.trim() && !validEmail(email.trim()))
      setEmailError("Địa chỉ email không hợp lệ.")
  }
  const submit = async () => {
    if (submittingRef.current) return
    const normalizedEmail = email.trim().toLowerCase()
    if (!validEmail(normalizedEmail)) {
      setError("Vui lòng nhập email hợp lệ.")
      return
    }
    if (!password || password.length > 72) {
      setError("Vui lòng nhập mật khẩu hợp lệ (tối đa 72 ký tự).")
      return
    }
    if (register) {
      if (!fullName.trim() || fullName.trim().length > 150) {
        setError("Họ và tên cần 1–150 ký tự.")
        return
      }
      const invalid = passwordError(password)
      if (invalid) {
        setError(invalid)
        return
      }
      if (password !== confirmPassword) {
        setError("Mật khẩu xác nhận không khớp.")
        return
      }
      if (selectedRole !== "Client" && selectedRole !== "Freelancer") {
        setError("Chỉ được đăng ký CLIENT hoặc FREELANCER.")
        return
      }
    }
    submittingRef.current = true
    setSubmitting(true)
    setError("")
    setEmailError("")
    try {
      const user = register
        ? await authApi.register({
            email: normalizedEmail,
            password,
            fullName: fullName.trim(),
            role: selectedRole === "Client" ? "CLIENT" : "FREELANCER",
          })
        : await authApi.login({ email: normalizedEmail, password })
      setPassword("")
      setConfirmPassword("")
      openDashboard(user)
      notify(
        register
          ? phone.trim()
            ? "Tài khoản đã được tạo. Số điện thoại chưa được lưu."
            : "Đăng ký thành công!"
          : "Đăng nhập thành công!",
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể xác thực. Vui lòng thử lại.",
      )
      if (cause && typeof cause === "object" && "errors" in cause) {
        const fields = (cause as { errors: Record<string, string> }).errors
        if (fields.email) setEmailError(fields.email)
        if (Object.keys(fields).length)
          setError(Object.values(fields).join(" "))
      }
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  if (resetMode && !register)
    return (
      <PasswordResetPage
        initialEmail={email}
        back={() => setResetMode(false)}
      />
    )
  return (
    <main className="auth-page">
      <div
        className={`auth-card panel ${
          register ? "register-card" : "login-card"
        }`}
      >
        <div className="auth-brand">
          <Logo />
          <p>Kết nối. Hợp tác. Sáng tạo.</p>
        </div>
        <div className="auth-header-text">
          <h1>{register ? "Tạo tài khoản mới" : "Chào mừng bạn trở lại"}</h1>
          <p>
            {register
              ? "Chọn vai trò Freelancer hoặc Client để bắt đầu."
              : "Đăng nhập vào hệ thống LinkIT bằng tài khoản của bạn."}
          </p>
        </div>
        {register && (
          <div className="role-choice">
            {(["Freelancer", "Client"] as Role[]).map((r) => (
              <button
                type="button"
                className={selectedRole === r ? "active" : ""}
                onClick={() => setSelectedRole(r)}
                key={r}
              >
                {r === "Freelancer" ? (
                  <UserRound size={18} />
                ) : (
                  <BriefcaseBusiness size={18} />
                )}
                <strong>Đăng ký {r}</strong>
                <span>
                  {r === "Freelancer"
                    ? "Tìm dự án IT & gửi Proposal"
                    : "Đăng dự án & tuyển Freelancer"}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className={register ? "auth-form-grid" : "auth-form-stack"}>
          {register && (
            <label>
              Họ và tên *
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Ví dụ: Nguyễn Văn A"
              />
            </label>
          )}
          {register && (
            <label>
              Số điện thoại
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                type="tel"
                placeholder="0901234567 (tùy chọn)"
              />
            </label>
          )}
          <label className={register ? "full" : ""}>
            Địa chỉ email *
            <input
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              onBlur={handleEmailBlur}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              type="email"
              placeholder="ban@gmail.com"
              style={
                emailError
                  ? {
                      borderColor: "#ef4444",
                      boxShadow: "0 0 0 2px rgba(239, 68, 68, 0.15)",
                    }
                  : undefined
              }
            />
            {emailError && (
              <span
                style={{
                  color: "#ef4444",
                  fontSize: "0.82rem",
                  marginTop: "3px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontWeight: 500,
                }}
              >
                <AlertCircle size={14} /> {emailError}
              </span>
            )}
            {emailSuggestion && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  width: "100%",
                  marginTop: "6px",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setEmail(emailSuggestion)
                    setEmailError("")
                    setEmailSuggestion("")
                    setError("")
                  }}
                  style={{
                    fontSize: "0.8rem",
                    padding: "4px 12px",
                    borderRadius: "6px",
                    border: "1px solid #3b82f6",
                    background: "rgba(59, 130, 246, 0.1)",
                    color: "#2563eb",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Sửa nhanh thành: {emailSuggestion}
                </button>
              </div>
            )}
          </label>
          <label>
            Mật khẩu *
            <div className="password-field">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                type={showPassword ? "text" : "password"}
                placeholder={register ? "Từ 12–72 ký tự" : "Nhập mật khẩu"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          {register && (
            <label>
              Xác nhận mật khẩu *
              <div className="password-field">
                <input
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Nhập lại mật khẩu"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={
                    showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>
            </label>
          )}
        </div>
        {!register && (
          <div className="auth-forgot-row">
            <button
              type="button"
              onClick={() => {
                setResetMode(true)
                setError("")
              }}
            >
              Quên mật khẩu?
            </button>
          </div>
        )}
        {error && (
          <p className="auth-error">
            <AlertCircle size={15} />
            {error}
          </p>
        )}
        <button
          className="primary-button auth-submit"
          disabled={submitting}
          onClick={submit}
        >
          {submitting
            ? "Đang xử lý..."
            : register
              ? "Tạo tài khoản"
              : "Đăng nhập"}
        </button>
        <p className="auth-switch">
          {register ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
          <button
            type="button"
            onClick={() => go(register ? "login" : "register")}
          >
            {register ? "Đăng nhập" : "Đăng ký ngay"}
          </button>
        </p>
      </div>
    </main>
  )
}

function MenuIcon({ label }: { label: string }) {
  if (label === "Tổng quan") return <LayoutDashboard size={18} />
  if (label === "Hồ sơ của tôi") return <UserRound size={18} />
  if (label === "Tìm việc") return <Search size={18} />
  if (label === "Việc làm đã lưu") return <BookmarkCheck size={18} />
  if (label === "Đề xuất đã gửi") return <FileText size={18} />
  if (label === "Công việc của tôi") return <FolderKanban size={18} />
  if (label === "Công việc đang thực hiện") return <CheckCircle2 size={18} />
  if (label === "Quản lý người dùng") return <UsersRound size={18} />
  if (label === "Hỗ trợ") return <CircleHelp size={18} />
  return <BriefcaseBusiness size={18} />
}

function Sidebar({
  role,
  page,
  select,
  close,
  open,
  collapsed,
  toggle,
  width,
  setWidth,
  onPublic,
}: {
  role: Role
  page: string
  select: (x: string) => void
  close: () => void
  open: boolean
  collapsed: boolean
  toggle: () => void
  width: number
  setWidth: (width: number) => void
  onPublic: () => void
}) {
  const { profile, savedJobIds } = useStore()
  const startResize = (event: ReactPointerEvent) => {
    if (collapsed) return
    event.preventDefault()
    const startX = event.clientX
    const startWidth = width
    const move = (pointer: PointerEvent) =>
      setWidth(
        Math.min(240, Math.max(216, startWidth + pointer.clientX - startX)),
      )
    const stop = () => {
      document.removeEventListener("pointermove", move)
      document.removeEventListener("pointerup", stop)
    }
    document.addEventListener("pointermove", move)
    document.addEventListener("pointerup", stop)
  }
  return (
    <>
      <div className={open ? "overlay" : ""} onClick={close} />
      <aside
        className={`sidebar role-${role.toLowerCase()} ${open ? "open" : ""} ${
          collapsed ? "collapsed" : ""
        }`}
      >
        <button
          className="icon-button sidebar-edge-toggle"
          onClick={toggle}
          aria-label={collapsed ? "Mở rộng Sidebar" : "Thu gọn Sidebar"}
          title={collapsed ? "Mở rộng Sidebar" : "Thu gọn Sidebar"}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </button>
        <div className="sidebar-top">
          <button
            className="logo-button"
            onClick={onPublic}
            aria-label="Về trang chủ"
            title="LinkIT — Trang chủ"
          >
            <Logo />
            <span className="sidebar-compact-brand" aria-hidden="true">
              <Link2 size={23} />
            </span>
          </button>
          <button className="icon-button mobile-only" onClick={close}>
            <X />
          </button>
        </div>
        <nav>
          {menus[role].map((x) => (
            <button
              title={collapsed ? x : ""}
              key={x}
              className={`nav-item ${page === x ? "active" : ""}`}
              onClick={() => {
                select(x)
                close()
              }}
            >
              <MenuIcon label={x} />
              <span>{x}</span>
              {x === "Việc làm đã lưu" && savedJobIds.length > 0 && (
                <b>{savedJobIds.length}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-card">
            <UserAvatar
              className="avatar"
              avatarUrl={profile.avatarUrl}
              initials={profile.initials}
              alt={profile.name}
            />
            <div>
              <strong>{profile.name}</strong>
              <span>{role}</span>
            </div>
          </div>
        </div>
        {!collapsed && (
          <div
            className="sidebar-resizer"
            onPointerDown={startResize}
            role="separator"
            aria-orientation="vertical"
            aria-label="Độ rộng thanh điều hướng"
            aria-valuemin={216}
            aria-valuemax={240}
            aria-valuenow={width}
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault()
                setWidth(
                  Math.min(
                    240,
                    Math.max(
                      216,
                      width + (event.key === "ArrowRight" ? 8 : -8),
                    ),
                  ),
                )
              }
            }}
          />
        )}
      </aside>
    </>
  )
}

function DashboardHeader({
  role,
  onMenu,
  onPublic,
  onDashboard,
  onProfile,
  onSettings,
  onLogout,
  query,
  onQueryChange,

  theme,
  toggleTheme,
  hideSearch = false,
}: {
  role: Role
  onMenu: () => void
  onPublic: () => void
  onDashboard: () => void
  onProfile: () => void
  onSettings: () => void
  onLogout: () => void
  query: string
  onQueryChange: (value: string) => void

  theme: Theme
  toggleTheme: () => void
  hideSearch?: boolean
}) {
  const { navigateToDashboard } = useStore()
  return (
    <header>
      <button className="icon-button menu-button" onClick={onMenu}>
        <Menu />
      </button>
      {!hideSearch && (
        <div className="header-search">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Tìm công việc, kỹ năng..."
          />
          {query && (
            <button
              onClick={() => onQueryChange("")}
              aria-label="Xóa nội dung tìm kiếm"
            >
              <X />
            </button>
          )}
        </div>
      )}
      <div className="header-actions">
        <button className="login-link desktop-site-link" onClick={onPublic}>
          Xem website
        </button>
        <NotificationBell
          user={getSessionSnapshot().user}
          navigate={navigateToDashboard}
        />
        <AccountMenu
          role={role}
          onDashboard={onDashboard}
          onProfile={onProfile}
          onSettings={onSettings}
          onLogout={onLogout}
        />
      </div>
    </header>
  )
}

function Overview(props: {
  role: Role
  openJobs: () => void
  openAssignments: () => void
  navigateDashboard: (page: string) => void
  onCreateJob?: () => void
  onOpenJob?: (id: number | undefined, panel: "details" | "proposals") => void
}) {
  const user = getSessionSnapshot().user
  const [selected, setSelected] = useState<JobItem | null>(null)

  if (!user)
    return (
      <div className="panel" role="status">
        Đang xác nhận phiên đăng nhập…
      </div>
    )
  return (
    <>
      <DashboardOverview
        onCreateJob={props.onCreateJob}
        onOpenJob={props.onOpenJob}
        key={user.id + props.role}
        user={user}
        role={props.role}
        navigate={props.navigateDashboard}
        openAssignment={openWorkspace}
        renderJob={(job) => (
          <JobCard
            compact
            key={job.id}
            job={mapJobDtoToItem(job)}
            onOpen={() => setSelected(mapJobDtoToItem(job))}
          />
        )}
      />
      {selected && <JobModal job={selected} close={() => setSelected(null)} />}
    </>
  )
}

function ConfirmModal({
  title,
  text,
  close,
  confirm,
}: {
  title: string
  text: string
  close: () => void
  confirm: () => void | boolean | Promise<void | boolean>
}) {
  const dialog = useRef<HTMLDivElement>(null)
  const flight = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const dismiss = () => {
    if (!flight.current) close()
  }
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    const root = document.getElementById("root")
    const wasInert = root?.inert
    document.body.style.overflow = "hidden"
    if (root) root.inert = true
    dialog.current?.focus()
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        dismiss()
      }
      if (event.key !== "Tab") return
      const nodes = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled)",
        ) || [],
      )
      const first = nodes[0],
        last = nodes[nodes.length - 1]
      if (!first) {
        event.preventDefault()
        return
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault()
        last.focus()
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", keys)
    return () => {
      document.removeEventListener("keydown", keys)
      document.body.style.overflow = overflow
      if (root) root.inert = wasInert ?? false
      if (previous?.isConnected) previous.focus()
    }
  }, [])
  const submit = async () => {
    if (flight.current) return
    flight.current = true
    setBusy(true)
    setError("")
    try {
      if ((await confirm()) !== false) close()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể thực hiện thao tác.",
      )
    } finally {
      flight.current = false
      setBusy(false)
    }
  }
  return createPortal(
    <div className="modal-backdrop" onClick={dismiss}>
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="confirm-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-icon">
          <AlertCircle />
        </div>
        <h2>{title}</h2>
        <p>{text}</p>
        {error && <p role="alert">{error}</p>}
        <div>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={dismiss}
          >
            Hủy bỏ
          </button>
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "Đang xử lý…" : "Xác nhận"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

type ToastKind = "success" | "error" | "warning"

function getToastKind(text: string): ToastKind {
  const lower = text.toLowerCase()
  if (
    lower.includes("không có quyền") ||
    lower.includes("truy cập bị từ chối") ||
    lower.includes("forbidden") ||
    lower.includes("unauthorized") ||
    lower.includes("403") ||
    lower.includes("không thể") ||
    lower.includes("thất bại") ||
    lower.includes("không hợp lệ") ||
    lower.includes("vượt quá") ||
    lower.includes("lỗi") ||
    lower.includes("đã bị khóa") ||
    lower.includes("không chính xác") ||
    lower.includes("không tồn tại") ||
    lower.includes("tối đa")
  ) {
    return "error"
  }
  if (
    lower.includes("vui lòng") ||
    lower.includes("chỉ tài khoản") ||
    lower.includes("chức năng") ||
    lower.includes("trước đó") ||
    lower.includes("chưa có") ||
    lower.includes("cảnh báo")
  ) {
    return "warning"
  }
  return "success"
}

function Toast({ text, close }: { text: string ; close: () => void }) {
  const [closing, setClosing] = useState(false)
  const closeRef = useRef(close)
  closeRef.current = close
  const kind = getToastKind(text)

  useEffect(() => {
    setClosing(false)
    const displayDuration =
      kind === "error" ? 5000 : kind === "warning" ? 4000 : 3000
    let removeTimer: ReturnType<typeof setTimeout> | null = null
    const autoHideTimer = setTimeout(() => {
      setClosing(true)
      removeTimer = setTimeout(() => {
        closeRef.current()
      }, 200)
    }, displayDuration)

    return () => {
      clearTimeout(autoHideTimer)
      if (removeTimer) clearTimeout(removeTimer)
    }
  }, [text, kind])

  const handleManualClose = () => {
    if (closing) return
    setClosing(true)
    setTimeout(() => {
      closeRef.current()
    }, 180)
  }

  const titleText =
    kind === "error"
      ? "Thông báo lỗi"
      : kind === "warning"
        ? "Cảnh báo"
        : "Thành công"
  const variantClass =
    kind === "error"
      ? " toast-error"
      : kind === "warning"
        ? " toast-warning"
        : ""

  return (
    <div
      className={`success-toast${variantClass}${
        closing ? " toast-closing" : ""
      }`}
    >
      {kind === "success" ? <CheckCircle2 /> : <AlertCircle />}
      <div>
        <strong>{titleText}</strong>
        <span>{text}</span>
      </div>
      <button onClick={handleManualClose} aria-label="Đóng thông báo">
        <X size={16} />
      </button>
    </div>
  )
}

function normalizePublicSkills(skills: string[]): string[] {
  const aliases: Record<string, string> = {
    javascript: "JavaScript",
    javascripts: "JavaScript",
    js: "JavaScript",
    typescript: "TypeScript",
    react: "React",
    reactjs: "React",
    nodejs: "Node.js",
    mysql: "MySQL",
    java: "Java",
    springboot: "Spring Boot",
    sqlserver: "SQL Server",
    nextjs: "Next.js",
    vuejs: "Vue.js",
  }
  const unique = new Set<string>()
  const result: string[] = []
  for (const raw of skills) {
    for (const part of raw.split(/[,;]+/)) {
      const trimmed = part.trim()
      if (!trimmed) continue
      const key = trimmed.toLowerCase().replace(/[\\s._-]+/g, "")
      const display = aliases[key] || trimmed
      const normalized = display.toLowerCase()
      if (unique.has(normalized)) continue
      unique.add(normalized)
      result.push(display)
    }
  }
  return result
}

function ProfileManager() {
  const {
    profile,
    assignments,

    profileTab,
    setProfileTab,
    updateProfileInfo,
    openCvPreview,
    downloadCvFile,
    upsertProfileRecord,
    deleteProfileRecord,
    refreshFreelancerData,
    notify,
  } = useStore()
  const tab = profileTab
  const setTab = setProfileTab
  const tabs: ProfileTab[] = [
    "Thông tin cá nhân",
    "Kỹ năng",
    "Kinh nghiệm làm việc",
    "Portfolio",
    "CV",
    "Đánh giá",
  ]
  const [title, setTitle] = useState(profile.title || "")
  const [bio, setBio] = useState(profile.bio || "")
  const [savingProfile, setSavingProfile] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [savingRecord, setSavingRecord] = useState(false)
  const [editingItem, setEditingItem] = useState<{
    id: string
    title: string
    proficiency?: number
    yearsExperience?: number | null
  } | null>(null)
  const [proficiency, setProficiency] = useState(1)
  const [yearsExperience, setYearsExperience] = useState("0")
  const [skillSearch, setSkillSearch] = useState("")
  const [skillSelected, setSkillSelected] = useState<string[]>([])
  const [skillPickerOpen, setSkillPickerOpen] = useState(false)
  const skillSuggestions = [
    "React",
    "Java",
    "JavaScript",
    "TypeScript",
    "Spring Boot",
    "Node.js",
    "Python",
    "SQL Server",
    "Docker",
    "Git",
    "REST API",
    "HTML",
    "CSS",
    "PostgreSQL",
    "Angular",
    "Vue.js",
    "Next.js",
    "AWS",
    "Figma",
    "C#",
  ]
  const [loadedSkills, setLoadedSkills] =
    useState<FreelancerProfileData["skills"]>([])
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [skillsError, setSkillsError] = useState("")
  useEffect(() => {
    if (tab !== "Kỹ năng") return
    let active = true
    setSkillsLoading(true)
    setSkillsError("")
    skillApi
      .mine()
      .then((skills) => {
        if (active)
          setLoadedSkills(
            skills.map((s) => ({
              id: String(s.id),
              title: s.name,
              proficiency: s.proficiency,
              yearsExperience: s.yearsExperience,
              updatedAt: "Đã đồng bộ",
            })),
          )
      })
      .catch((error) => {
        if (active)
          setSkillsError(
            error instanceof Error ? error.message : "Không thể tải kỹ năng.",
          )
      })
      .finally(() => {
        if (active) setSkillsLoading(false)
      })
    return () => {
      active = false
    }
  }, [tab, profile.skills])
  const [inputValue, setInputValue] = useState("")
  const [selectedCvFile, setSelectedCvFile] = useState<File | null>(null)
  const [workForm, setWorkForm] = useState<WorkExperienceInput>({
    companyName: "",
    position: "",
    startDate: "",
    endDate: null,
    isCurrent: false,
    description: "",
    achievements: "",
  })
  const [portfolioForm, setPortfolioForm] = useState<PortfolioInput>({
    title: "",
    description: "",
    role: "",
    technologies: "",
    projectUrl: "",
    githubUrl: "",
    startDate: null,
    endDate: null,
  })
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState("")
  const [historyRetry, setHistoryRetry] = useState(0)
  useEffect(() => {
    if (
      ![
        "Thông tin cá nhân",
        "CV",
        "Kinh nghiệm làm việc",
        "Portfolio",
        "Đánh giá",
      ].includes(tab)
    )
      return
    let active = true
    setHistoryLoading(true)
    setHistoryError("")
    refreshFreelancerData()
      .then((ok) => {
        if (active && !ok)
          setHistoryError("Không thể tải dữ liệu hồ sơ. Vui lòng thử lại.")
      })
      .catch(() => {
        if (active) setHistoryError("Không thể tải dữ liệu hồ sơ.")
      })
      .finally(() => {
        if (active) setHistoryLoading(false)
      })
    return () => {
      active = false
    }
  }, [tab, historyRetry, refreshFreelancerData])
  const [deletingRecord, setDeletingRecord] = useState<{
    id: string
    title: string
  } | null>(null)
  const reviewsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTitle(profile.title || "")
    setBio(profile.bio || "")
  }, [profile.title, profile.bio])

  useEffect(() => {
    if (tab === "Đánh giá" && reviewsRef.current) {
      reviewsRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      })
    }
  }, [tab])

  const records =
    tab === "CV"
      ? profile.cvs
      : tab === "Kỹ năng"
        ? loadedSkills
        : tab === "Kinh nghiệm làm việc"
          ? profile.experiences
          : profile.portfolios
  const sortedExperiences = [...profile.experiences].sort((a, b) => {
    const toTimestamp = (value?: string | null) => {
      if (!value) return 0
      const match = value.match(/^(\\d{2})\/(\\d{2})\/(\\d{4})$/)
      const timestamp = Date.parse(
        match ? `${match[3]}-${match[2]}-${match[1]}` : value,
      )
      return Number.isNaN(timestamp) ? 0 : timestamp
    }
    return toTimestamp(b.work?.startDate) - toTimestamp(a.work?.startDate)
  })
  const skillItems = loadedSkills
  const normalizeSkill = (name: string) => {
    const key = name
      .trim()
      .toLowerCase()
      .replace(/[\s._-]+/g, "")
    const aliases: Record<string, string> = {
      javascript: "JavaScript",
      javascripts: "JavaScript",
      js: "JavaScript",
      typescript: "TypeScript",
      react: "React",
      reactjs: "React",
      nodejs: "Node.js",
      mysql: "MySQL",
      java: "Java",
      python: "Python",
      springboot: "Spring Boot",
      sqlserver: "SQL Server",
      nextjs: "Next.js",
      vuejs: "Vue.js",
    }
    return aliases[key] || name.trim()
  }
  const skillEntries = skillItems
    .flatMap((item) =>
      item.title
        .split(/[,;]+/)
        .map((name) => ({ name: normalizeSkill(name), item })),
    )
    .filter((entry) => entry.name)
  const uniqueSkills = skillEntries.filter(
    (entry, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.name.toLowerCase() === entry.name.toLowerCase(),
      ) === index,
  )
  const selectedSkillNames = new Set(
    uniqueSkills.map((entry) => entry.name.toLowerCase()),
  )
  const visibleSuggestions = [
    ...new Set(
      [...skillSuggestions, ...uniqueSkills.map((entry) => entry.name)].map(
        normalizeSkill,
      ),
    ),
  ].filter((name) =>
    name.toLowerCase().includes(skillSearch.trim().toLowerCase()),
  )
  const addSelectedSkills = async () => {
    const names = [...new Set(skillSelected.map(normalizeSkill))].filter(
      (name) => !selectedSkillNames.has(name.toLowerCase()),
    )
    if (!names.length) {
      notify("Hãy chọn ít nhất một kỹ năng chưa có.")
      return
    }
    setSavingRecord(true)
    let count = 0
    for (const name of names) {
      try {
        const saved = await upsertProfileRecord(
          "Kỹ năng",
          name,
          undefined,
          null,
          { proficiency: 3, yearsExperience: 0 },
        )
        if (saved === false) break
        count++
      } catch {
        break
      }
    }
    setSavingRecord(false)
    if (count) {
      setSkillSelected([])
      setSkillSearch("")
      setSkillPickerOpen(false)
      {
        try {
          const skills = await skillApi.mine()
          setLoadedSkills(
            skills.map((skill) => ({
              id: String(skill.id),
              title: skill.name,
              proficiency: skill.proficiency,
              yearsExperience: skill.yearsExperience,
              updatedAt: "Đã đồng bộ",
            })),
          )
        } catch {
          notify("Đã lưu nhưng không thể tải lại kỹ năng. Vui lòng mở lại tab.")
        }
      }
    }
    if (count < names.length)
      notify(
        `Đã lưu ${count}/${names.length} kỹ năng. Hãy kiểm tra và thử lại các mục còn thiếu.`,
      )
  }
  const reviewsList = getFreelancerReviews(profile, assignments)
  const completedCount = profile.completedJobs ?? 0
  const avgScore =
    reviewsList.length > 0
      ? (
          reviewsList.reduce((sum, r) => sum + r.rating, 0) / reviewsList.length
        ).toFixed(1)
      : profile.averageRating && profile.averageRating > 0
        ? profile.averageRating.toFixed(1)
        : "0.0"

  const openAdd = () => {
    if (tab === "Thông tin cá nhân" || tab === "Đánh giá") {
      setTab("Kỹ năng")
    }
    setEditingItem(null)
    setProficiency(1)
    setYearsExperience("0")
    setInputValue("")
    setSelectedCvFile(null)
    setWorkForm({
      companyName: "",
      position: "",
      startDate: "",
      endDate: null,
      isCurrent: false,
      description: "",
      achievements: "",
    })
    setPortfolioForm({
      title: "",
      description: "",
      role: "",
      technologies: "",
      projectUrl: "",
      githubUrl: "",
      startDate: null,
      endDate: null,
    })
    setModalOpen(true)
  }

  const openEditRecord = (item: { id: string ; title: string }) => {
    if (tab === "Kinh nghiệm làm việc") {
      const work = profile.experiences.find((record) => record.id === item.id)
        ?.work
      if (!work) {
        notify("Vui lòng tải lại để lấy đầy đủ dữ liệu kinh nghiệm.")
        return
      }
      setWorkForm({
        companyName: work.companyName,
        position: work.position,
        startDate: work.startDate || "",
        endDate: work.endDate || null,
        isCurrent: work.isCurrent ?? false,
        description: work.description || "",
        achievements: work.achievements,
        version: work.version,
      })
    }
    if (tab === "Portfolio") {
      const project = profile.portfolios.find((record) => record.id === item.id)
        ?.portfolio
      if (!project) {
        notify("Vui lòng tải lại để lấy đầy đủ thông tin dự án.")
        return
      }
      setPortfolioForm({
        title: project.title,
        description: project.description || "",
        role: project.role,
        technologies: project.technologies || "",
        projectUrl: project.projectUrl || "",
        githubUrl: project.githubUrl || "",
        startDate: project.startDate,
        endDate: project.endDate,
        version: project.version,
      })
    }
    const skill = item as FreelancerProfileData["skills"][number]
    setEditingItem(skill)
    setProficiency(skill.proficiency ?? 1)
    setYearsExperience(String(skill.yearsExperience ?? 0))
    setInputValue(item.title)
    setSelectedCvFile(null)
    setModalOpen(true)
  }

  const handleSaveProfile = async () => {
    if (savingProfile) return
    if (bio.length > 500) {
      notify("Nội dung giới thiệu tối đa 500 ký tự.")
      return
    }
    setSavingProfile(true)
    const ok = await updateProfileInfo({
      title: title.trim(),
      bio: bio.trim(),
    })
    setSavingProfile(false)
    if (ok) notify("Đã lưu thông tin hồ sơ cá nhân vào hệ thống.")
  }

  const handleSaveRecord = async () => {
    if (savingRecord) return
    if (tab === "CV" && !editingItem && !selectedCvFile) {
      notify("Vui lòng chọn tệp CV định dạng PDF từ máy tính để tải lên.")
      return
    }
    const finalTitle =
      tab === "Kinh nghiệm làm việc"
        ? `${workForm.position.trim()} · ${workForm.companyName.trim()}`
        : tab === "Portfolio"
          ? portfolioForm.title.trim()
          : selectedCvFile
            ? selectedCvFile.name
            : inputValue.trim()
    if (
      tab === "CV" &&
      selectedCvFile &&
      (!selectedCvFile.name.toLowerCase().endsWith(".pdf") ||
        selectedCvFile.size === 0 ||
        selectedCvFile.size > 2 * 1024 * 1024 ||
        selectedCvFile.name.length > 255)
    ) {
      notify(
        "Vui lòng chọn PDF không rỗng, tối đa 2 MB, tên tệp tối đa 255 ký tự.",
      )
      return
    }
    const today = new Date().toISOString().slice(0, 10)
    if (
      tab === "Kinh nghiệm làm việc" &&
      (!workForm.companyName.trim() ||
        !workForm.position.trim() ||
        !workForm.description.trim() ||
        workForm.companyName.length > 200 ||
        workForm.position.length > 200 ||
        workForm.description.length > 10000 ||
        workForm.achievements.length > 10000 ||
        !workForm.startDate ||
        workForm.startDate > today ||
        (!workForm.isCurrent &&
          (!workForm.endDate ||
            workForm.endDate < workForm.startDate ||
            workForm.endDate > today)))
    ) {
      notify(
        "Vui lòng nhập vị trí, công ty, mô tả và ngày làm việc hợp lệ. Ngày kết thúc không được trước ngày bắt đầu hoặc sau hôm nay.",
      )
      return
    }
    if (tab === "Portfolio") {
      if (
        !portfolioForm.title.trim() ||
        !portfolioForm.description.trim() ||
        !portfolioForm.role.trim() ||
        !portfolioForm.technologies.trim() ||
        portfolioForm.title.length > 200 ||
        portfolioForm.role.length > 200 ||
        portfolioForm.technologies.length > 500 ||
        portfolioForm.description.length > 10000 ||
        (portfolioForm.endDate &&
          (!portfolioForm.startDate ||
            portfolioForm.endDate < portfolioForm.startDate))
      ) {
        notify(
          "Vui lòng nhập đầy đủ tên, mô tả, vai trò, công nghệ và khoảng ngày dự án hợp lệ.",
        )
        return
      }
      for (const link of [portfolioForm.projectUrl, portfolioForm.githubUrl]) {
        if (!link.trim()) continue
        try {
          const url = new URL(link.trim())
          if (
            link.length > 1000 ||
            !["https:", "http:"].includes(url.protocol) ||
            url.username ||
            url.password
          )
            throw Error()
        } catch {
          notify(
            "Liên kết dự án/GitHub phải là URL HTTP(S) hợp lệ, tối đa 1000 ký tự, không chứa thông tin đăng nhập.",
          )
          return
        }
      }
    }
    if (
      tab === "Kỹ năng" &&
      (finalTitle.length > 100 ||
        !/^\d+$/.test(yearsExperience) ||
        Number(yearsExperience) > 32767)
    ) {
      notify(
        "Tên kỹ năng tối đa 100 ký tự; số năm kinh nghiệm phải là số nguyên từ 0 đến 32767.",
      )
      return
    }
    if (!finalTitle) {
      notify(`Vui lòng nhập thông tin cho ${tab}.`)
      return
    }
    setSavingRecord(true)
    const saved = await upsertProfileRecord(
      tab as "Kỹ năng" | "Kinh nghiệm làm việc" | "Portfolio" | "CV",
      finalTitle,
      editingItem?.id,
      selectedCvFile,
      { proficiency, yearsExperience: Number(yearsExperience) },
      { work: workForm, portfolio: portfolioForm },
    )
    setSavingRecord(false)
    if (saved === false) return
    setSelectedCvFile(null)
    setModalOpen(false)
  }

  return (
    <section className="panel function-panel profile-panel linkit-profile-viewport">
      <style>{`
        .linkit-skill-summary{border:1px solid #dcece3;background:#f9fcfa;border-radius:14px;padding:17px 18px;margin-bottom:16px}.linkit-skill-summary-head{display:flex;justify-content:space-between;gap:12px;font-size:12px;color:#64748b;margin-bottom:12px}.linkit-skill-summary-head>span:first-child{display:flex;align-items:center;gap:6px;color:#174b35;font-weight:750}.linkit-skill-chips{display:flex;flex-wrap:wrap;gap:9px}.linkit-skill-chips button{display:inline-flex;align-items:center;gap:7px;padding:8px 12px;border:1px solid #cce8d9;background:white;border-radius:9px;color:#167849;font-size:13px;font-weight:650;cursor:pointer}.linkit-skill-chips .linkit-skill-add{border-style:dashed;background:#eff9f3}.linkit-skill-picker{width:min(520px,calc(100vw - 28px));max-height:90vh;overflow:auto}.linkit-picker-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.linkit-picker-head h2{font-size:19px;margin:0 0 6px}.linkit-picker-head p{color:#64748b;font-size:13px;margin:0 0 20px}.linkit-picker-search{width:100%;padding:12px;border:1px solid #d5e0e7;border-radius:10px;margin-bottom:14px}.linkit-picker-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:310px;overflow-y:auto}.linkit-picker-option{display:flex;align-items:center;gap:9px;border:1px solid #e2e8f0;border-radius:9px;padding:11px;cursor:pointer;font-size:13px}.linkit-picker-option input{accent-color:#08a35c}.linkit-picker-option.is-existing{opacity:.55;cursor:default}.linkit-picker-option small{font-size:10px;margin-left:auto}.linkit-picker-custom{display:flex;align-items:center;gap:6px;margin-top:10px;color:#087e49;background:none;border:none;cursor:pointer}.linkit-picker-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b}@media(max-width:520px){.linkit-picker-options{grid-template-columns:1fr}}.linkit-profile-records{padding:24px 0 4px}.linkit-profile-section-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:20px}.linkit-profile-section-heading h3{font-size:18px;line-height:1.35;font-weight:750;color:#15263d;margin:0 0 5px}.linkit-profile-section-heading p{font-size:13px;color:#728096;margin:0}.linkit-profile-count{white-space:nowrap;background:#f1f5f9;border:1px solid #e4eaf0;border-radius:20px;padding:5px 12px;font-size:12px;color:#53657b;font-weight:650}.linkit-profile-list{display:grid;gap:14px}.linkit-skill-grid,.linkit-portfolio-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.linkit-profile-card{min-width:0;display:flex;flex-direction:column;justify-content:space-between;gap:18px;padding:20px;border:1px solid #e4eaf0;border-radius:16px;background:#fff;box-shadow:0 3px 12px rgba(22,42,68,.035);transition:border-color .2s,box-shadow .2s}.linkit-profile-card:hover{border-color:#b9d9ca;box-shadow:0 8px 22px rgba(22,42,68,.065)}.linkit-profile-card-main{display:flex;align-items:flex-start;gap:14px;min-width:0}.linkit-profile-card-icon{display:grid;place-items:center;flex:0 0 42px;height:42px;background:#eaf8f0;border-radius:12px;color:#07934d}.linkit-profile-card-content{min-width:0;flex:1}.linkit-profile-card-content h4{font-size:15px;line-height:1.5;font-weight:750;color:#16263d;margin:0 0 7px;overflow-wrap:anywhere}.linkit-profile-meta{display:flex;align-items:center;flex-wrap:wrap;gap:8px 14px;font-size:12px;color:#65758b}.linkit-profile-meta>span{display:inline-flex;align-items:center;gap:5px}.linkit-skill-level,.linkit-current-pill{padding:4px 9px;border-radius:7px;background:#eaf8f0;color:#078349;font-weight:650}.linkit-profile-description{font-size:13px;line-height:1.75;color:#475569;white-space:pre-wrap;overflow-wrap:anywhere;margin:12px 0 0}.linkit-profile-achievement{display:flex;gap:8px;background:#f5faf7;border-radius:10px;padding:11px 12px;margin-top:12px;color:#345d47;font-size:13px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere}.linkit-profile-achievement svg{flex-shrink:0;margin-top:2px}.linkit-tech-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}.linkit-tech-tags span{font-size:11px;font-weight:650;color:#3c5874;background:#f1f5f9;padding:5px 9px;border-radius:7px}.linkit-project-links{display:flex;flex-wrap:wrap;gap:16px;margin-top:14px}.linkit-project-links a{display:inline-flex;align-items:center;gap:4px;color:#008b4b;font-size:12px;font-weight:700;text-decoration:none}.linkit-profile-muted{font-size:12px;color:#718096;margin:0}.linkit-profile-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px;border-top:1px solid #edf1f4;padding-top:12px}.linkit-action-button{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid #e2e8f0;border-radius:8px;padding:7px 10px;background:#fff;color:#475569;font-size:12px;font-weight:650;cursor:pointer}.linkit-action-button:hover{background:#f4f8f6;border-color:#bedccc;color:#087f48}.linkit-action-danger{color:#b94b51}.linkit-action-danger:hover{color:#b42332;background:#fff5f5;border-color:#fecaca}.linkit-profile-empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding:42px 20px;border:1px dashed #cbd5e1;border-radius:16px;color:#64748b}.linkit-profile-empty strong{color:#23354b}.linkit-profile-empty p{font-size:13px;margin:0 0 8px}.linkit-profile-empty svg{color:#0a9b55}@media(max-width:850px){.linkit-skill-grid,.linkit-portfolio-grid{grid-template-columns:1fr}.linkit-profile-card{padding:16px}}@media(max-width:520px){.linkit-profile-section-heading{flex-wrap:wrap}.linkit-profile-card-main{gap:10px}.linkit-profile-card-icon{flex-basis:36px;height:36px}.linkit-profile-actions{justify-content:flex-start}.linkit-action-button{min-height:36px}}
      .profile-panel .linkit-profile-records{padding-top:28px}.profile-panel .linkit-profile-section-heading{margin-bottom:15px}.profile-panel .linkit-profile-section-heading h3{font-size:17px}.profile-panel .linkit-profile-section-heading p{font-size:12px}.profile-panel .linkit-skill-summary{margin:0;padding:0;border:0;border-radius:0;background:transparent}.profile-panel .linkit-skill-chips{gap:9px}.profile-panel .linkit-skill-chips button{padding:9px 14px;border:1px solid #dce5e4;border-radius:9px;background:#f8faf9;color:#263c40;font-size:13px;font-weight:600;box-shadow:none}.profile-panel .linkit-skill-chips button:hover{background:#edf7f1;border-color:#9dcdb3;color:#087a48}.profile-panel .linkit-profile-count{font-size:12px;background:#f7f9fa;border-color:#e7edf0}.profile-panel .linkit-profile-section-heading p{margin-bottom:0}
        .profile-panel .linkit-career-timeline{position:relative;gap:0;padding-left:24px;border-left:2px solid #e5ede9;margin-left:12px}
        .profile-panel .linkit-career-timeline .linkit-refined-card{position:relative;border:0;border-bottom:1px solid #e8edf0;border-radius:0;box-shadow:none;padding:18px 8px 20px 0;margin:0;background:transparent;min-height:0}
        .profile-panel .linkit-career-timeline .linkit-refined-card:first-child{padding-top:6px}
        .profile-panel .linkit-career-timeline .linkit-refined-card:last-child{border-bottom:0}
        .profile-panel .linkit-career-timeline .linkit-refined-card:before{content:"";position:absolute;left:-32px;top:26px;width:12px;height:12px;border:3px solid #0aa566;background:#fff;border-radius:50%}
        .profile-panel .linkit-career-timeline .linkit-refined-card:hover{box-shadow:none;border-color:#e8edf0}
        .profile-panel .linkit-career-timeline .linkit-profile-card-icon{display:none}
        .profile-panel .linkit-career-timeline .linkit-profile-card-content h4{font-size:16px;margin-bottom:5px}
        .profile-panel .linkit-career-timeline .linkit-profile-description{margin-top:10px}
        .profile-panel .linkit-career-timeline .linkit-profile-achievement{padding:0;margin-top:9px;background:none;color:#4a5c60}
        .profile-panel .linkit-profile-refined-grid{grid-template-columns:repeat(2,minmax(0,1fr));align-items:stretch;gap:16px}
        .profile-panel .linkit-profile-refined-grid .linkit-refined-card{border:1px solid #e4e9ee;box-shadow:0 3px 16px rgba(17,34,53,.035);padding:19px;min-height:0}
        .profile-panel .linkit-profile-refined-grid .linkit-profile-card-icon{width:38px;height:38px;flex-basis:38px}
        .profile-panel .linkit-profile-refined-grid .linkit-profile-description{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;margin-top:9px}
        .profile-panel .linkit-profile-refined-grid .linkit-tech-tags{margin-top:12px}
        .profile-panel .linkit-refined-card{gap:8px}
        .profile-panel .linkit-refined-card .linkit-profile-actions.linkit-refined-actions{border:0;padding:0;position:absolute;top:13px;right:12px;gap:5px}
        .profile-panel .linkit-refined-card{position:relative}
        .profile-panel .linkit-refined-card .linkit-profile-card-content{padding-right:68px}
        .profile-panel .linkit-refined-card .linkit-refined-actions .linkit-action-button{width:29px;height:29px;padding:0;border:0;background:transparent;color:#8795a5}
        .profile-panel .linkit-refined-card .linkit-refined-actions .linkit-action-button:hover{background:#f0f5f2;color:#087b4d}
        .profile-panel .linkit-refined-card .linkit-refined-actions .linkit-action-danger:hover{background:#fff0f0;color:#c23543}
        @media(max-width:900px){.profile-panel .linkit-profile-refined-grid{grid-template-columns:1fr}}
        @media(max-width:520px){.profile-panel .linkit-refined-card .linkit-profile-card-content{padding-right:55px}.profile-panel .linkit-career-timeline{padding-left:17px;margin-left:6px}.profile-panel .linkit-career-timeline .linkit-refined-card:before{left:-25px}}

        .profile-panel .linkit-experience-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px;align-items:stretch}
        .profile-panel .linkit-experience-cards .linkit-refined-card{display:block;min-height:0;border:1px solid #e3e9ef;border-radius:15px;background:#fff;padding:20px 20px 18px;box-shadow:0 2px 12px rgba(16,36,60,.035)}
        .profile-panel .linkit-experience-cards .linkit-refined-card:hover{border-color:#c8ddd3;box-shadow:0 5px 20px rgba(16,36,60,.06)}
        .profile-panel .linkit-experience-cards .linkit-profile-card-icon{display:grid;place-items:center;width:39px;height:39px;flex-basis:39px;border-radius:11px;background:#eff6f2}
        .profile-panel .linkit-experience-cards .linkit-profile-card-main{gap:12px}
        .profile-panel .linkit-experience-cards .linkit-profile-card-content h4{font-size:15px;line-height:1.45;margin:0 0 6px;font-weight:750}
        .profile-panel .linkit-experience-cards .linkit-profile-meta{font-size:12px;gap:6px}
        .profile-panel .linkit-experience-cards .linkit-profile-description{margin-top:13px;font-size:13px;line-height:1.6;color:#536479;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden}
        .profile-panel .linkit-experience-cards .linkit-profile-achievement{margin-top:11px;padding:0;background:transparent;color:#43576a;font-size:12px;line-height:1.6}
        .profile-panel .linkit-experience-cards .linkit-profile-achievement svg{color:#0a985c}
        .profile-panel .linkit-experience-cards .linkit-refined-card .linkit-profile-card-content{padding-right:55px}
        .profile-panel .linkit-experience-cards .linkit-refined-actions{top:16px;right:14px}
        @media(max-width:1000px){.profile-panel .linkit-experience-cards{grid-template-columns:1fr}}
        @media(max-width:520px){.profile-panel .linkit-experience-cards .linkit-refined-card{padding:16px}.profile-panel .linkit-experience-cards .linkit-profile-card-icon{display:none}}

        .profile-panel .linkit-experience-table-scroll{width:100%;overflow-x:auto;border:1px solid #e2e8ef;border-radius:13px;background:#fff}
        .profile-panel .linkit-experience-table{width:100%;min-width:850px;border-collapse:collapse;text-align:left;font-size:13px}
        .profile-panel .linkit-experience-table th{background:#e2f6ee;color:#086b50;font-size:13px;font-weight:800;padding:15px 17px;border-bottom:1px solid #b9e6d4;white-space:nowrap;text-align:center;vertical-align:middle}
        .profile-panel .linkit-experience-table td{padding:18px 17px;vertical-align:top;border-bottom:1px solid #edf1f4;color:#4b5d70;line-height:1.6}
        .profile-panel .linkit-experience-table tbody tr:last-child td{border-bottom:0}
        .profile-panel .linkit-experience-table tbody tr:hover{background:#fbfdfc}
        .profile-panel .linkit-experience-table th:nth-child(1){width:14%}
        .profile-panel .linkit-experience-table th:nth-child(2){width:14%}
        .profile-panel .linkit-experience-table th:nth-child(3){width:18%}
        .profile-panel .linkit-experience-table th:nth-child(4){width:24%}
        .profile-panel .linkit-experience-table th:nth-child(5){width:22%}\n        .profile-panel .linkit-experience-table th:nth-child(6){width:8%}
        .profile-panel .linkit-experience-table td strong{color:#182b40;font-size:13px;font-weight:750}
        .profile-panel .linkit-table-dates{display:block;white-space:nowrap;font-variant-numeric:tabular-nums}
        .profile-panel .linkit-table-current{display:inline-block;margin-top:7px;padding:2px 8px;border-radius:6px;background:#e8f8ee;color:#087b48;font-size:11px;font-weight:650}
        .profile-panel .linkit-table-description{white-space:pre-wrap;overflow-wrap:anywhere}
        .profile-panel .linkit-table-achievement{display:flex;align-items:flex-start;gap:6px;color:#167b53;margin-top:6px;overflow-wrap:anywhere}
        .profile-panel .linkit-table-achievement svg{flex:none;margin-top:3px}
        .profile-panel .linkit-table-actions{display:flex;gap:6px;white-space:nowrap}
        .profile-panel .linkit-table-actions button{display:grid;place-items:center;width:30px;height:30px;border:1px solid #e4eaf0;background:#fff;border-radius:8px;color:#64748b;cursor:pointer}
        .profile-panel .linkit-table-actions button:hover{background:#eef8f2;color:#008c50}
        .profile-panel .linkit-table-actions button:last-child:hover{background:#fff0f0;color:#bf3441}

        .profile-panel .linkit-portfolio-editorial{display:flex;flex-direction:column;gap:12px;width:100%;max-width:none}
        .profile-panel .linkit-portfolio-editorial .linkit-refined-card{width:100%;min-height:0;padding:20px 22px;border:1px solid #e3e9ec;border-radius:13px;background:#fff;box-shadow:none;gap:0}
        .profile-panel .linkit-portfolio-editorial .linkit-refined-card:hover{border-color:#b8d9c9;box-shadow:0 4px 14px rgba(12,42,33,.04)}
        .profile-panel .linkit-portfolio-editorial .linkit-profile-card-main{align-items:flex-start;gap:15px}
        .profile-panel .linkit-portfolio-editorial .linkit-profile-card-icon{width:42px;height:42px;flex:0 0 42px;border-radius:11px;background:#eaf7f0}
        .profile-panel .linkit-portfolio-editorial .linkit-profile-card-content{padding-right:75px}
        .profile-panel .linkit-portfolio-editorial .linkit-profile-card-content h4{font-size:16px;font-weight:750;line-height:1.4;margin-bottom:6px}
        .profile-panel .linkit-portfolio-editorial .linkit-profile-meta{font-size:12px;color:#758296}
        .profile-panel .linkit-portfolio-editorial .linkit-profile-description{font-size:13px;line-height:1.65;margin:10px 0 0;color:#475569;display:block;overflow:visible;white-space:pre-wrap}
        .profile-panel .linkit-portfolio-editorial .linkit-tech-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:13px}
        .profile-panel .linkit-portfolio-editorial .linkit-tech-tags span{font-size:11px;padding:5px 9px;border-radius:6px;background:#f1f5f7;color:#506174;font-weight:600}
        .profile-panel .linkit-portfolio-editorial .linkit-project-links{margin-top:12px}
        .profile-panel .linkit-portfolio-editorial .linkit-refined-actions{top:16px;right:16px}
        @media(max-width:600px){.profile-panel .linkit-portfolio-editorial .linkit-refined-card{padding:16px}.profile-panel .linkit-portfolio-editorial .linkit-profile-card-content{padding-right:48px}.profile-panel .linkit-portfolio-editorial .linkit-profile-card-icon{display:none}}

        .profile-panel .linkit-cv-polished{display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:18px;min-height:86px;padding:16px 18px;border:1px solid #e1e9ee;border-radius:13px;background:#fff;box-shadow:0 2px 10px rgba(15,37,58,.035)}
        .profile-panel .linkit-cv-polished .linkit-profile-card-main{display:flex;align-items:center;gap:13px;flex:1;min-width:0}
        .profile-panel .linkit-cv-polished .linkit-profile-card-icon{width:44px;height:44px;flex:0 0 44px;border-radius:11px;background:#eaf7f0;color:#0a9257}
        .profile-panel .linkit-cv-polished .linkit-profile-card-content{padding:0;min-width:0}
        .profile-panel .linkit-cv-polished .linkit-profile-card-content h4{font-size:14px;line-height:1.4;margin:0 0 5px;overflow-wrap:anywhere}
        .profile-panel .linkit-cv-polished .linkit-profile-muted{font-size:12px;color:#7a8898;margin:0}
        .profile-panel .linkit-cv-polished .linkit-refined-actions{position:static;display:flex;align-items:center;gap:8px;flex:0 0 auto;padding:0;border:0}
        .profile-panel .linkit-cv-polished .linkit-refined-actions .linkit-cv-action{display:inline-flex;align-items:center;justify-content:center;gap:7px;width:auto;height:35px;padding:0 12px;border:1px solid #dce7e3;border-radius:9px;background:#fff;color:#176c50;font-size:12px;font-weight:700;white-space:nowrap}
        .profile-panel .linkit-cv-polished .linkit-refined-actions .linkit-cv-action:hover{background:#edf8f2;border-color:#a8d5bf;color:#087849}
        .profile-panel .linkit-cv-polished .linkit-refined-actions .linkit-action-danger{width:35px;height:35px;border:1px solid #e6eaf0;border-radius:9px;background:#fff;color:#94a0ad}
        .profile-panel .linkit-cv-polished .linkit-refined-actions .linkit-action-danger:hover{background:#fff0f1;border-color:#f3cbd0;color:#bf3441}
        @media(max-width:650px){.profile-panel .linkit-cv-polished{flex-wrap:wrap}.profile-panel .linkit-cv-polished .linkit-refined-actions{width:100%;justify-content:flex-start;padding-left:57px}}
        @media(max-width:420px){.profile-panel .linkit-cv-polished .linkit-refined-actions{padding-left:0}.profile-panel .linkit-cv-polished .linkit-refined-actions .linkit-cv-action{padding:0 9px}}

        .linkit-profile-viewport{width:100%;max-width:none;min-width:0;min-height:calc(100dvh - 155px);height:auto;box-sizing:border-box;display:flex;flex-direction:column;align-self:stretch}
        .linkit-profile-viewport .linkit-profile-records{flex:1;min-height:0;width:100%;min-width:0}
        .linkit-profile-viewport .profile-edit{flex:1;min-width:0;width:100%}
        .linkit-profile-viewport .linkit-experience-table-scroll{max-width:100%}
        @media(max-width:768px){.linkit-profile-viewport{min-height:calc(100dvh - 115px)}}
`}</style>

      <div className="management-head">
        <div>
          <h2>Hồ sơ Freelancer</h2>
        </div>
        {tab !== "Đánh giá" && tab !== "Thông tin cá nhân" && (
          <button
            className="primary-button"
            disabled={savingRecord}
            onClick={
              tab === "Kỹ năng" ? () => setSkillPickerOpen(true) : openAdd
            }
          >
            <Plus />
            {tab === "Kỹ năng" ? "Thêm kỹ năng" : "Thêm mới"}
          </button>
        )}
      </div>
      <div className="content-tabs">
        {tabs.map((x) => (
          <button
            className={tab === x ? "active" : ""}
            disabled={savingRecord}
            onClick={() => setTab(x)}
            key={x}
          >
            {x}
          </button>
        ))}
      </div>
      {tab === "Thông tin cá nhân" ? (
        <div className="profile-edit freelancer-profile-edit">
          <AvatarUploadControl
            wrapperClassName="avatar-upload"
            buttonLabel="Thay ảnh"
          />
          <div className="form-grid">
            <label>
              <span className="field-label-text">Họ và tên</span>
              <input
                value={profile.name}
                readOnly
                aria-readonly="true"
                className="readonly-field-input"
              />
              <small className="field-helper-text">
                Đồng bộ trực tiếp từ họ tên tài khoản đã đăng ký (thay đổi tại
                Cài đặt tài khoản).
              </small>
            </label>
            <label>
              <span className="field-label-text">Chức danh</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Full-stack Developer, UI/UX Designer..."
              />
            </label>
            <label className="full">
              <div className="field-label-row">
                <span className="field-label-text">Giới thiệu</span>
                <small
                  style={{
                    color: bio.length >= 500 ? "#ef4444" : "#6b7280",
                    fontWeight: 500,
                  }}
                >
                  {bio.length}/500 ký tự
                </small>
              </div>
              <textarea
                rows={5}
                value={bio}
                maxLength={500}
                onChange={(e) => setBio(e.target.value.slice(0, 500))}
                placeholder="Giới thiệu về bản thân, kinh nghiệm, thế mạnh và lĩnh vực bạn muốn làm việc..."
              />
            </label>
            <div className="form-actions full">
              <button
                className="secondary-button"
                disabled={savingProfile}
                onClick={() => {
                  setTitle(profile.title || "")
                  setBio(profile.bio || "")
                }}
              >
                Hủy
              </button>
              <button
                className="primary-button"
                disabled={savingProfile}
                onClick={handleSaveProfile}
              >
                {savingProfile ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      ) : tab === "Đánh giá" && historyLoading ? (
        <p role="status">Đang tải đánh giá…</p>
      ) : tab === "Đánh giá" && historyError ? (
        <div role="alert">
          <p>{historyError}</p>
          <button
            className="secondary-button"
            onClick={() => setHistoryRetry((n) => n + 1)}
          >
            Tải lại
          </button>
        </div>
      ) : tab === "Đánh giá" ? (
        <div
          id="profile-reviews-section"
          ref={reviewsRef}
          className="profile-reviews-section"
        >
          <div className="business-note profile-rating-summary">
            <Star fill="currentColor" />
            <div>
              <strong>
                Điểm đánh giá trung bình: {avgScore}/5 ({reviewsList.length}{" "}
                đánh giá)
              </strong>
              <p>
                Tổng hợp từ {completedCount} công việc đã hoàn thành trên nền
                tảng LinkIT.
              </p>
            </div>
          </div>
          {reviewsList.length > 0 ? (
            <div className="structured-list">
              {reviewsList.map((rev) => (
                <div key={rev.id} className="review-record-item">
                  <div className="record-icon">
                    <Star />
                  </div>
                  <div>
                    <strong>
                      {rev.jobTitle} · {rev.rating}.0/5 sao
                    </strong>
                    <span>
                      {rev.company} · {rev.createdAt}
                    </span>
                    <p style={{ marginTop: "6px" }}>{rev.comment}</p>
                  </div>
                  <div
                    className="rating-input"
                    aria-label={`${rev.rating} trên 5 sao`}
                  >
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={15}
                        fill={star <= rev.rating ? "currentColor" : "none"}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="proposal-empty">
              <Star />
              <strong>Chưa có đánh giá nào</strong>
              <span>
                Đánh giá từ Client sẽ hiển thị tại đây sau khi bạn hoàn thành
                các Assignment.
              </span>
            </div>
          )}
        </div>
      ) : ["CV", "Kinh nghiệm làm việc", "Portfolio"].includes(tab) &&
        historyLoading ? (
        <p role="status">Đang tải hồ sơ...</p>
      ) : ["CV", "Kinh nghiệm làm việc", "Portfolio"].includes(tab) &&
        historyError ? (
        <div role="alert">
          <p>{historyError}</p>
          <button
            className="secondary-button"
            onClick={() => setHistoryRetry((n) => n + 1)}
          >
            Tải lại
          </button>
        </div>
      ) : (
        <div className="linkit-profile-records">
          {tab !== "CV" && (
            <div className="linkit-profile-section-heading">
              <div>
                <h3>
                  {tab === "Kỹ năng"
                    ? "Kỹ năng chuyên môn"
                    : tab === "Kinh nghiệm làm việc"
                      ? "Hành trình sự nghiệp"
                      : tab === "Portfolio"
                        ? "Dự án nổi bật"
                        : "CV của bạn"}
                </h3>
                <p>
                  {tab === "Kỹ năng"
                    ? "Những công nghệ và năng lực bạn sử dụng trong công việc."
                    : tab === "Kinh nghiệm làm việc"
                      ? "Các vị trí, trách nhiệm và thành tựu đã đạt được."
                      : tab === "Portfolio"
                        ? "Sản phẩm thực tế và dấu ấn chuyên môn của bạn."
                        : "Quản lý tài liệu ứng tuyển và xem trước CV."}
                </p>
              </div>
              {!skillsLoading && !historyLoading && (
                <span className="linkit-profile-count">
                  {tab === "Kỹ năng" ? uniqueSkills.length : records.length}{" "}
                  {tab === "Kỹ năng" ? "kỹ năng" : "mục"}
                </span>
              )}
            </div>
          )}
          {tab === "Kỹ năng" && (
            <div className="linkit-skill-summary">
              <div className="linkit-skill-chips">
                {uniqueSkills.map(({ name, item }) => (
                  <button
                    key={name.toLowerCase()}
                    type="button"
                    title="Chỉnh sửa kỹ năng"
                    onClick={() => openEditRecord(item)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {tab === "Kinh nghiệm làm việc" && records.length > 0 ? (
            <div
              className="linkit-experience-table-scroll"
              role="region"
              aria-label="Bảng kinh nghiệm làm việc"
              tabIndex={0}
            >
              <table className="linkit-experience-table">
                <thead>
                  <tr>
                    <th>Vị trí</th>
                    <th>Công ty</th>
                    <th>Thời gian</th>
                    <th>Mô tả công việc</th>
                    <th>Thành tựu</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedExperiences.map((item) => {
                    const parts = item.title.split(" · ")
                    const roleName = parts[0] || item.title
                    const companyName =
                      parts.length > 1
                        ? parts.slice(1).join(" · ")
                        : "Chưa cập nhật"
                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>{roleName}</strong>
                        </td>
                        <td>{companyName}</td>
                        <td>
                          <span className="linkit-table-dates">
                            {formatDateUi(item.work?.startDate)} –{" "}
                            {item.work?.isCurrent
                              ? "Hiện tại"
                              : formatDateUi(item.work?.endDate || undefined)}
                          </span>
                          {item.work?.isCurrent && (
                            <span className="linkit-table-current">
                              Đang làm việc
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="linkit-table-description">
                            {item.work?.description || "—"}
                          </div>
                        </td>
                        <td>
                          {item.work?.achievements ? (
                            <div className="linkit-table-achievement">
                              <CheckCircle2 size={14} />
                              <span>{item.work.achievements}</span>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <div className="linkit-table-actions">
                            <button
                              type="button"
                              title="Chỉnh sửa"
                              aria-label={`Chỉnh sửa ${item.title}`}
                              onClick={() => openEditRecord(item)}
                            >
                              <Settings size={16} />
                            </button>
                            <button
                              type="button"
                              title="Xóa"
                              aria-label={`Xóa ${item.title}`}
                              onClick={() => setDeletingRecord(item)}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : tab === "Kỹ năng" && skillsLoading ? (
            <p role="status">Đang tải kỹ năng...</p>
          ) : tab === "Kỹ năng" && skillsError ? (
            <div role="alert">
              {skillsError}
              <button
                className="text-button"
                onClick={() => setHistoryRetry((n) => n + 1)}
              >
                Thử lại
              </button>
            </div>
          ) : tab === "Kỹ năng" ? null : records.length > 0 ? (
            <div
              className={
                tab === "Portfolio"
                  ? "linkit-portfolio-grid linkit-portfolio-editorial"
                  : tab === "Kinh nghiệm làm việc"
                    ? "linkit-profile-list linkit-experience-cards"
                    : "linkit-profile-list"
              }
            >
              {records.map((item) => (
                <article
                  key={item.id}
                  className={`linkit-profile-card linkit-profile-card--${
                    tab === "Portfolio"
                      ? "portfolio"
                      : tab === "CV"
                        ? "cv"
                        : "experience"
                  } linkit-refined-card ${
                    tab === "CV" ? "linkit-cv-polished" : ""
                  }`}
                >
                  <div className="linkit-profile-card-main">
                    <span className="linkit-profile-card-icon">
                      {tab === "CV" ? (
                        <FileText size={20} />
                      ) : tab === "Kinh nghiệm làm việc" ? (
                        <BriefcaseBusiness size={20} />
                      ) : (
                        <FolderKanban size={20} />
                      )}
                    </span>
                    <div className="linkit-profile-card-content">
                      <h4>{item.title}</h4>
                      {tab === "CV" && (
                        <p className="linkit-profile-muted">{item.updatedAt}</p>
                      )}
                      {tab === "Kinh nghiệm làm việc" &&
                        "work" in item &&
                        item.work && (
                          <>
                            <div className="linkit-profile-meta">
                              <span>
                                <Clock3 size={14} />
                                {formatDateUi(item.work.startDate)} –{" "}
                                {item.work.isCurrent
                                  ? "Hiện tại"
                                  : formatDateUi(
                                      item.work.endDate || undefined,
                                    )}
                              </span>
                              {item.work.isCurrent && (
                                <span className="linkit-current-pill">
                                  Đang làm việc
                                </span>
                              )}
                            </div>
                            <p className="linkit-profile-description">
                              {item.work.description}
                            </p>
                            {item.work.achievements && (
                              <div className="linkit-profile-achievement">
                                <CheckCircle2 size={16} />
                                <span>
                                  <b>Thành tựu:</b> {item.work.achievements}
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      {tab === "Portfolio" &&
                        "portfolio" in item &&
                        item.portfolio && (
                          <>
                            <div className="linkit-profile-meta">
                              <span>{item.portfolio.role}</span>
                              {(item.portfolio.startDate ||
                                item.portfolio.endDate) && (
                                <span>
                                  {formatDateUi(
                                    item.portfolio.startDate || undefined,
                                  )}{" "}
                                  –{" "}
                                  {item.portfolio.endDate
                                    ? formatDateUi(item.portfolio.endDate)
                                    : "Hiện tại"}
                                </span>
                              )}
                            </div>
                            <p className="linkit-profile-description">
                              {item.portfolio.description}
                            </p>
                            <div className="linkit-tech-tags">
                              {(item.portfolio.technologies ?? "")
                                .split(/[,;]+/)
                                .map((tech) => tech.trim())
                                .filter(Boolean)
                                .map((tech, i) => (
                                  <span key={`${tech}-${i}`}>{tech}</span>
                                ))}
                            </div>
                            {(item.portfolio.projectUrl ||
                              item.portfolio.githubUrl) && (
                              <div className="linkit-project-links">
                                {item.portfolio.projectUrl && (
                                  <a
                                    href={item.portfolio.projectUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    Xem dự án <ArrowRight size={14} />
                                  </a>
                                )}
                                {item.portfolio.githubUrl && (
                                  <a
                                    href={item.portfolio.githubUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    Mã nguồn <ArrowRight size={14} />
                                  </a>
                                )}
                              </div>
                            )}
                          </>
                        )}
                    </div>
                  </div>
                  <div className="linkit-profile-actions linkit-refined-actions">
                    {tab === "CV" ? (
                      <>
                        <button
                          type="button"
                          className="linkit-action-button linkit-cv-action"
                          title="Xem trước CV"
                          onClick={() =>
                            void openCvPreview(item.id, item.title)
                          }
                        >
                          <Eye size={16} />
                          <span>Xem CV</span>
                        </button>
                        <button
                          type="button"
                          className="linkit-action-button linkit-cv-action"
                          title="Tải CV"
                          onClick={() =>
                            void downloadCvFile(item.id, item.title)
                          }
                        >
                          <Download size={16} />
                          <span>Tải xuống</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="linkit-action-button"
                        title="Chỉnh sửa"
                        aria-label={`Chỉnh sửa ${item.title}`}
                        onClick={() => openEditRecord(item)}
                      >
                        <Settings size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="linkit-action-button linkit-action-danger"
                      title="Xóa"
                      aria-label={`Xóa ${item.title}`}
                      onClick={() => setDeletingRecord(item)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="linkit-profile-empty">
              <Inbox size={30} />
              <strong>Chưa có thông tin {tab.toLowerCase()}</strong>
              <p>
                Thêm nội dung để hồ sơ của bạn chuyên nghiệp và nổi bật hơn với
                nhà tuyển dụng.
              </p>
              <button
                type="button"
                className="primary-button"
                onClick={openAdd}
              >
                <Plus size={16} /> Thêm mới
              </button>
            </div>
          )}
        </div>
      )}
      {skillPickerOpen &&
        createPortal(
          <div
            className="modal-backdrop"
            onMouseDown={() => !savingRecord && setSkillPickerOpen(false)}
          >
            <div
              className="panel function-panel linkit-skill-picker"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="linkit-picker-head">
                <div>
                  <h2>Thêm kỹ năng chuyên môn</h2>
                  <p>Tích chọn nhiều kỹ năng, sau đó lưu một lần.</p>
                </div>
                <button
                  type="button"
                  className="linkit-action-button"
                  onClick={() => setSkillPickerOpen(false)}
                  aria-label="Đóng"
                >
                  <X size={18} />
                </button>
              </div>
              <input
                className="linkit-picker-search"
                value={skillSearch}
                onChange={(e) => setSkillSearch(e.target.value)}
                placeholder="Tìm React, Java, TypeScript..."
                autoFocus
              />
              <div className="linkit-picker-options">
                {visibleSuggestions.map((name) => {
                  const existing = selectedSkillNames.has(name.toLowerCase())
                  const checked = existing || skillSelected.includes(name)
                  return (
                    <label
                      key={name}
                      className={`linkit-picker-option ${
                        existing ? "is-existing" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={existing || savingRecord}
                        onChange={(e) =>
                          setSkillSelected((prev) =>
                            e.target.checked
                              ? [...prev, name]
                              : prev.filter((v) => v !== name),
                          )
                        }
                      />
                      <span>{name}</span>
                      {existing && <small>Đã thêm</small>}
                    </label>
                  )
                })}
              </div>
              {skillSearch.trim() &&
                !visibleSuggestions.some(
                  (v) => v.toLowerCase() === skillSearch.trim().toLowerCase(),
                ) &&
                !selectedSkillNames.has(skillSearch.trim().toLowerCase()) && (
                  <button
                    type="button"
                    className="linkit-picker-custom"
                    onClick={() =>
                      setSkillSelected((prev) =>
                        prev.includes(skillSearch.trim())
                          ? prev
                          : [...prev, skillSearch.trim()],
                      )
                    }
                  >
                    <Plus size={15} /> Chọn kỹ năng “{skillSearch.trim()}”
                  </button>
                )}
              <div className="linkit-picker-footer">
                <span>Đã chọn {skillSelected.length} kỹ năng mới</span>
                <button
                  className="primary-button"
                  disabled={savingRecord || !skillSelected.length}
                  onClick={() => void addSelectedSkills()}
                >
                  {savingRecord ? "Đang lưu..." : "Lưu kỹ năng"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      {modalOpen &&
        tab !== "Thông tin cá nhân" &&
        tab !== "Đánh giá" &&
        createPortal(
          <div
            className="modal-backdrop"
            onMouseDown={() => !savingRecord && setModalOpen(false)}
          >
            <div
              className="panel function-panel"
              style={{
                width:
                  tab === "Kinh nghiệm làm việc" || tab === "Portfolio"
                    ? "min(640px, 100%)"
                    : "min(460px, 100%)",
                minHeight: "auto",
                maxHeight: "90vh",
                overflowY: "auto",
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="record-header">
                <div>
                  <h2>
                    {editingItem ? `Chỉnh sửa ${tab}` : `Thêm mới ${tab}`}
                  </h2>
                  <p>Cập nhật dữ liệu vào hồ sơ Freelancer của bạn.</p>
                </div>
              </div>
              <div className="form-grid">
                {tab === "Kinh nghiệm làm việc" && (
                  <>
                    <label className="full">
                      Chức danh / Vị trí *
                      <input
                        maxLength={200}
                        value={workForm.position}
                        onChange={(e) =>
                          setWorkForm((prev) => ({
                            ...prev,
                            position: e.target.value,
                          }))
                        }
                        autoFocus
                        required
                      />
                    </label>
                    <label className="full">
                      Công ty *
                      <input
                        maxLength={200}
                        value={workForm.companyName}
                        onChange={(e) =>
                          setWorkForm((prev) => ({
                            ...prev,
                            companyName: e.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                    <label>
                      Ngày bắt đầu *
                      <input
                        type="date"
                        min="0001-01-01"
                        max={new Date().toISOString().slice(0, 10)}
                        value={workForm.startDate}
                        onChange={(e) =>
                          setWorkForm((prev) => ({
                            ...prev,
                            startDate: e.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                    <label>
                      Ngày kết thúc{!workForm.isCurrent && " *"}
                      <input
                        type="date"
                        min={workForm.startDate || "0001-01-01"}
                        max={new Date().toISOString().slice(0, 10)}
                        disabled={workForm.isCurrent}
                        value={workForm.endDate || ""}
                        onChange={(e) =>
                          setWorkForm((prev) => ({
                            ...prev,
                            endDate: e.target.value || null,
                          }))
                        }
                        required={!workForm.isCurrent}
                      />
                    </label>
                    <label className="full">
                      <span>
                        <input
                          type="checkbox"
                          checked={workForm.isCurrent}
                          onChange={(e) =>
                            setWorkForm((prev) => ({
                              ...prev,
                              isCurrent: e.target.checked,
                              endDate: e.target.checked ? null : prev.endDate,
                            }))
                          }
                        />{" "}
                        Đang làm việc tại đây
                      </span>
                    </label>
                    <label className="full">
                      Mô tả công việc *
                      <textarea
                        rows={4}
                        maxLength={10000}
                        value={workForm.description}
                        onChange={(e) =>
                          setWorkForm((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                    <label className="full">
                      Thành tựu
                      <textarea
                        rows={3}
                        maxLength={10000}
                        value={workForm.achievements}
                        onChange={(e) =>
                          setWorkForm((prev) => ({
                            ...prev,
                            achievements: e.target.value,
                          }))
                        }
                      />
                    </label>
                  </>
                )}
                {tab === "Portfolio" && (
                  <>
                    <label className="full">
                      Tên dự án *
                      <input
                        maxLength={200}
                        value={portfolioForm.title}
                        onChange={(e) =>
                          setPortfolioForm((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }))
                        }
                        autoFocus
                        required
                      />
                    </label>
                    <label className="full">
                      Vai trò trong dự án *
                      <input
                        maxLength={200}
                        value={portfolioForm.role}
                        onChange={(e) =>
                          setPortfolioForm((prev) => ({
                            ...prev,
                            role: e.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                    <label className="full">
                      Công nghệ sử dụng *
                      <input
                        maxLength={500}
                        value={portfolioForm.technologies}
                        onChange={(e) =>
                          setPortfolioForm((prev) => ({
                            ...prev,
                            technologies: e.target.value,
                          }))
                        }
                        placeholder="Nhập các công nghệ đã sử dụng"
                        required
                      />
                    </label>
                    <label>
                      Ngày bắt đầu
                      <input
                        type="date"
                        min="0001-01-01"
                        max="9999-12-31"
                        value={portfolioForm.startDate || ""}
                        onChange={(e) =>
                          setPortfolioForm((prev) => ({
                            ...prev,
                            startDate: e.target.value || null,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Ngày kết thúc
                      <input
                        type="date"
                        min={portfolioForm.startDate || "0001-01-01"}
                        max="9999-12-31"
                        value={portfolioForm.endDate || ""}
                        onChange={(e) =>
                          setPortfolioForm((prev) => ({
                            ...prev,
                            endDate: e.target.value || null,
                          }))
                        }
                      />
                    </label>
                    <label className="full">
                      Liên kết dự án
                      <input
                        type="url"
                        maxLength={1000}
                        value={portfolioForm.projectUrl}
                        onChange={(e) =>
                          setPortfolioForm((prev) => ({
                            ...prev,
                            projectUrl: e.target.value,
                          }))
                        }
                        placeholder="https://..."
                      />
                    </label>
                    <label className="full">
                      Liên kết mã nguồn / GitHub
                      <input
                        type="url"
                        maxLength={1000}
                        value={portfolioForm.githubUrl}
                        onChange={(e) =>
                          setPortfolioForm((prev) => ({
                            ...prev,
                            githubUrl: e.target.value,
                          }))
                        }
                        placeholder="https://github.com/..."
                      />
                    </label>
                    <label className="full">
                      Mô tả dự án, kết quả đạt được *
                      <textarea
                        rows={5}
                        maxLength={10000}
                        value={portfolioForm.description}
                        onChange={(e) =>
                          setPortfolioForm((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                  </>
                )}
                {tab === "Kỹ năng" && (
                  <>
                    <label className="full">
                      Mức độ
                      <select
                        value={proficiency}
                        onChange={(e) => setProficiency(Number(e.target.value))}
                      >
                        <option value={1}>Cơ bản</option>
                        <option value={2}>Trung bình</option>
                        <option value={3}>Thành thạo</option>
                        <option value={5}>Chuyên gia</option>
                        {proficiency === 4 && (
                          <option value={4}>Chuyên gia (4/5)</option>
                        )}
                      </select>
                    </label>
                    <label className="full">
                      Số năm kinh nghiệm
                      <input
                        type="number"
                        min={0}
                        max={32767}
                        step={1}
                        value={yearsExperience}
                        onChange={(e) => setYearsExperience(e.target.value)}
                        required
                      />
                    </label>
                  </>
                )}
                {tab === "CV" && !editingItem && (
                  <label className="full">
                    Chọn tệp CV (PDF) từ máy tính
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null
                        setSelectedCvFile(f)
                        if (f) setInputValue(f.name)
                      }}
                    />
                  </label>
                )}
                {tab === "Kỹ năng" && (
                  <label className="full">
                    {`Tên ${tab}`}
                    <input
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveRecord()}
                      placeholder="Nhập nội dung..."
                      autoFocus
                    />
                  </label>
                )}
                {tab === "CV" && (
                  <small className="full">
                    Chỉ nhận PDF, tối đa 2 MB. Chỉ bạn truy cập CV trong hồ sơ.
                    Nếu bạn đính kèm CV vào Proposal, Client chủ Job cũng được
                    xem/tải qua Proposal đó. CV đã đính kèm không thể xóa; bạn
                    có thể tải CV mới.
                  </small>
                )}
              </div>
              <div className="form-actions">
                <button
                  className="secondary-button"
                  disabled={savingRecord}
                  onClick={() => setModalOpen(false)}
                >
                  Hủy
                </button>
                <button
                  className="primary-button"
                  disabled={savingRecord}
                  onClick={handleSaveRecord}
                >
                  {savingRecord ? "Đang lưu..." : "Lưu"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      {deletingRecord && (
        <ConfirmModal
          title={`Xóa mục khỏi ${tab}?`}
          text={`Bạn có chắc chắn muốn xóa "${deletingRecord.title}" khỏi hồ sơ cá nhân không?`}
          close={() => setDeletingRecord(null)}
          confirm={() =>
            deleteProfileRecord(
              tab as "Kỹ năng" | "Kinh nghiệm làm việc" | "Portfolio" | "CV",
              deletingRecord.id,
            )
          }
        />
      )}
    </section>
  )
}

function ProposalManager() {
  const user = getSessionSnapshot().user
  return user ? (
    <ProposalsScreen key={user.id} user={user} />
  ) : (
    <div className="panel empty-state">Vui lòng đăng nhập.</div>
  )
}

function AssignmentManager({ client }: { client: boolean }) {
  const { navigateToDashboard } = useStore()
  const user = getSessionSnapshot().user
  return user ? (
    <AssignmentsScreen
      key={user.id}
      user={user}
      navigate={navigateToDashboard}
      viewRole={client ? "Client" : "Freelancer"}
      listMode="work"
    />
  ) : (
    <div className="panel empty-state">Vui lòng đăng nhập.</div>
  )
}

function JobManager({
  admin = false,
  initialJobId,
  initialAction = "details",
}: {
  admin?: boolean
  initialJobId?: number
  initialAction?: "details" | "proposals" | "create"
}) {
  const { notify } = useStore()
  const [assignments, setAssignments] = useState(false)
  const user = getSessionSnapshot().user

  return (
    <>
      {admin && (
        <div className="content-tabs">
          <button
            className={!assignments ? "active" : ""}
            onClick={() => setAssignments(false)}
          >
            Job
          </button>
          <button
            className={assignments ? "active" : ""}
            onClick={() => setAssignments(true)}
          >
            Assignment
          </button>
        </div>
      )}
      {admin && assignments && user ? (
        <AssignmentsScreen key={user.id} user={user} />
      ) : (
        <Jobs
          manage
          admin={admin}
          initialCreate={initialAction === "create"}
          initialPanel={initialAction === "proposals" ? "proposals" : "details"}
          initialId={initialJobId}
          user={user}
          authPending={getSessionSnapshot().status === "loading"}
          onLogin={() => notify("Vui lòng đăng nhập.")}
          renderDescription={(text) => <RichDescription text={text} />}
        />
      )}
    </>
  )
}

function UserManager() {
  const { users, profile, toggleUserLock, notify } = useStore()
  const [query, setQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("Mọi vai trò")
  const [selectedId, setSelectedId] = useState(users[0]?.id || "")
  const [confirmLock, setConfirmLock] = useState(false)

  const filtered = users.filter((u) => {
    const matchText =
      !query.trim() ||
      `${u.name} ${u.email}`.toLowerCase().includes(query.trim().toLowerCase())
    const matchRole = roleFilter === "Mọi vai trò" || u.role === roleFilter
    return matchText && matchRole
  })

  const activeUser =
    filtered.find((u) => u.id === selectedId) || filtered[0] || users[0]
  const isBlocked = activeUser?.status === "Đã khóa"
  const isSelfAdmin =
    activeUser?.role === "Admin" ||
    activeUser?.email.toLowerCase() === profile.email.toLowerCase()

  return (
    <div className="manager-split">
      <section className="panel manager-list">
        <div className="management-head">
          <div>
            <h2>Người dùng</h2>
            <p>Tìm kiếm theo vai trò và trạng thái</p>
          </div>
        </div>
        <div className="mini-filter">
          <Search />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm người dùng..."
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option>Mọi vai trò</option>
            <option>Freelancer</option>
            <option>Client</option>
            <option>Admin</option>
          </select>
        </div>
        {filtered.map((u) => (
          <button
            className={activeUser?.id === u.id ? "selected" : ""}
            onClick={() => setSelectedId(u.id)}
            key={u.id}
          >
            <div>
              <strong>{u.name}</strong>
              <span>{u.role}</span>
            </div>
            <b
              className={`status ${
                u.status === "Đã khóa" ? "state-blocked" : "state-active"
              }`}
            >
              {u.status}
            </b>
          </button>
        ))}
      </section>
      {activeUser && (
        <section className="panel assignment-detail">
          <div className="profile-hero">
            <div className="talent-avatar">{activeUser.initials}</div>
            <div>
              <h2>{activeUser.name}</h2>
              <p>
                {activeUser.email} · {activeUser.role}
              </p>
            </div>
          </div>
          <div className="detail-stats">
            <div>
              <span>Ngày tham gia</span>
              <strong>{activeUser.joinedAt}</strong>
            </div>
            <div>
              <span>Trạng thái</span>
              <strong>{activeUser.status}</strong>
            </div>
          </div>
          <div className="danger-zone">
            <div>
              <strong>Kiểm soát tài khoản</strong>
              <p>
                {isSelfAdmin
                  ? "Tài khoản Quản trị viên đang đăng nhập."
                  : "Thao tác theo quyền quản trị hệ thống."}
              </p>
            </div>
            <button
              disabled={isSelfAdmin}
              onClick={() => {
                if (isSelfAdmin) {
                  notify("Không thể khóa tài khoản quản trị viên hiện tại.")
                  return
                }
                setConfirmLock(true)
              }}
            >
              {isBlocked ? "Mở khóa tài khoản" : "Khóa tài khoản"}
            </button>
          </div>
        </section>
      )}
      {confirmLock && activeUser && (
        <ConfirmModal
          title={isBlocked ? "Mở khóa tài khoản này?" : "Khóa tài khoản này?"}
          text={
            isBlocked
              ? `Tài khoản ${activeUser.name} (${activeUser.email}) sẽ được phép đăng nhập trở lại.`
              : `Người dùng ${activeUser.name} (${activeUser.email}) sẽ không thể đăng nhập cho đến khi được mở khóa.`
          }
          close={() => setConfirmLock(false)}
          confirm={() => {
            setConfirmLock(false)
            toggleUserLock(activeUser.id)
          }}
        />
      )}
    </div>
  )
}

function ClientProfileManager() {
  const { profile, updateProfileInfo, notify } = useStore()
  const [title, setTitle] = useState(profile.title || "")
  const [bio, setBio] = useState(profile.bio || "")
  const [companyName, setCompanyName] = useState("")
  const [industry, setIndustry] = useState("")
  const [location, setLocation] = useState("")
  const [companyWebsite, setCompanyWebsite] = useState("")
  const [publicContactPhone, setPublicContactPhone] = useState("")
  const [publicContactEmail, setPublicContactEmail] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [savedValues, setSavedValues] = useState({
    title: "",
    bio: "",
    companyName: "",
    industry: "",
    location: "",
    companyWebsite: "",
    publicContactPhone: "",
    publicContactEmail: "",
  })

  useEffect(() => {
    let active = true
    setLoaded(false)
    setLoadError("")
    clientCompanyApi
      .mine()
      .then((data) => {
        if (!active) return
        const values = {
          title: data.title || "",
          bio: data.bio || "",
          companyName: data.companyName || "",
          industry: data.industry || "",
          location: data.location || "",
          companyWebsite: data.companyWebsite || "",
          publicContactPhone: data.publicContactPhone || "",
          publicContactEmail: data.publicContactEmail || "",
        }
        setSavedValues(values)
        setTitle(values.title)
        setBio(values.bio)
        setCompanyName(values.companyName)
        setIndustry(values.industry)
        setLocation(values.location)
        setCompanyWebsite(values.companyWebsite)
        setPublicContactPhone(values.publicContactPhone)
        setPublicContactEmail(values.publicContactEmail)
        setLoaded(true)
      })
      .catch((error) => {
        if (active)
          setLoadError(
            error instanceof Error
              ? error.message
              : "Không thể tải thông tin doanh nghiệp.",
          )
      })
    return () => {
      active = false
    }
  }, [refresh])

  const restore = () => {
    setTitle(savedValues.title)
    setBio(savedValues.bio)
    setCompanyName(savedValues.companyName)
    setIndustry(savedValues.industry)
    setLocation(savedValues.location)
    setCompanyWebsite(savedValues.companyWebsite)
    setPublicContactPhone(savedValues.publicContactPhone)
    setPublicContactEmail(savedValues.publicContactEmail)
  }

  const handleSaveClientProfile = async () => {
    if (savingProfile || !loaded) return
    const website = companyWebsite.trim()
    const contact = publicContactPhone.trim()
    const contactEmail = publicContactEmail.trim()
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      notify("Email liên hệ không hợp lệ.")
      return
    }
    if (
      bio.length > 500 ||
      title.length > 200 ||
      companyName.length > 200 ||
      industry.length > 100 ||
      location.length > 200 ||
      website.length > 1000
    ) {
      notify("Một số thông tin vượt quá giới hạn ký tự.")
      return
    }
    if (website && !/^https?:\/\/[^\s/]+(?:\/[^\s]*)?$/i.test(website)) {
      notify(
        "Website cần có địa chỉ đầy đủ bắt đầu bằng https:// hoặc http://.",
      )
      return
    }
    if (
      contact &&
      (!/^[+()\d\s.-]{8,20}$/.test(contact) ||
        (contact.match(/\d/g) || []).length < 8)
    ) {
      notify("Số điện thoại công khai không hợp lệ.")
      return
    }
    setSavingProfile(true)
    try {
      const saved = await clientCompanyApi.save({
        fullName: profile.name,
        title: title.trim(),
        bio: bio.trim(),
        companyName: companyName.trim(),
        industry: industry.trim(),
        location: location.trim(),
        companyWebsite: website,
        publicContactPhone: contact,
        publicContactEmail: contactEmail,
      })
      const next = {
        title: saved.title || "",
        bio: saved.bio || "",
        companyName: saved.companyName || "",
        industry: saved.industry || "",
        location: saved.location || "",
        companyWebsite: saved.companyWebsite || "",
        publicContactPhone: saved.publicContactPhone || "",
        publicContactEmail: saved.publicContactEmail || "",
      }
      setSavedValues(next)
      const synced = await updateProfileInfo({
        title: next.title,
        bio: next.bio,
      })
      if (synced)
        notify(
          "Đã lưu hồ sơ Client. Thông tin doanh nghiệp và liên hệ công khai đã được cập nhật.",
        )
      else
        notify(
          "Đã lưu thông tin doanh nghiệp, nhưng chưa đồng bộ một phần giao diện. Vui lòng tải lại.",
        )
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Không thể lưu hồ sơ doanh nghiệp.",
      )
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <section className="panel function-panel profile-panel client-profile-panel client-company-profile">
      <div className="management-head">
        <div>
          <h2>Hồ sơ Client</h2>
          <p>
            Cung cấp thông tin doanh nghiệp rõ ràng để Freelancer yên tâm hợp
            tác.
          </p>
        </div>
      </div>
      {loadError ? (
        <div role="alert" className="auth-error">
          {loadError}{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => setRefresh((n) => n + 1)}
          >
            Tải lại
          </button>
        </div>
      ) : null}
      <div className="profile-edit">
        <AvatarUploadControl
          compact
          wrapperClassName="avatar-upload client-profile-avatar"
          buttonLabel="Thay ảnh"
        />
        <div className="form-grid">
          <div className="full client-company-section-heading">
            <h3>Thông tin đại diện</h3>
            <span>Thông tin tài khoản và người phụ trách</span>
          </div>
          <label>
            <span className="field-label-text">Họ và tên</span>
            <input
              value={profile.name}
              readOnly
              aria-readonly="true"
              className="readonly-field-input"
            />
            <small className="field-helper-text">
              Thay đổi tại Cài đặt tài khoản.
            </small>
          </label>
          <label>
            <span className="field-label-text">Chức danh</span>
            <input
              value={title}
              maxLength={200}
              disabled={!loaded || savingProfile}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Giám đốc, Trưởng phòng tuyển dụng..."
            />
          </label>

          <div className="full client-company-section-heading">
            <h3>Thông tin doanh nghiệp công khai</h3>
            <span>
              Freelancer có thể xem các thông tin này từ công việc bạn đăng.
            </span>
          </div>
          <label>
            <span className="field-label-text">Tên công ty / tổ chức</span>
            <input
              value={companyName}
              maxLength={200}
              disabled={!loaded || savingProfile}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ví dụ: Công ty TNHH An Phát"
            />
          </label>
          <label>
            <span className="field-label-text">Lĩnh vực hoạt động</span>
            <input
              value={industry}
              maxLength={100}
              disabled={!loaded || savingProfile}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Ví dụ: Công nghệ, thương mại điện tử..."
            />
          </label>
          <label>
            <span className="field-label-text">Địa chỉ / khu vực làm việc</span>
            <input
              value={location}
              maxLength={200}
              disabled={!loaded || savingProfile}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ví dụ: Cầu Giấy, Hà Nội"
            />
            <small className="field-helper-text">
              Chỉ nhập địa chỉ doanh nghiệp bạn muốn công khai.
            </small>
          </label>
          <label>
            <span className="field-label-text">Website doanh nghiệp</span>
            <input
              value={companyWebsite}
              maxLength={1000}
              disabled={!loaded || savingProfile}
              onChange={(e) => setCompanyWebsite(e.target.value)}
              placeholder="https://congty.vn"
            />
          </label>
          <label className="full">
            <span className="field-label-text">Email liên hệ công khai</span>
            <input
              type="email"
              value={publicContactEmail}
              maxLength={254}
              disabled={!loaded || savingProfile}
              onChange={(e) => setPublicContactEmail(e.target.value)}
              placeholder="contact@congty.vn"
            />
            <small className="field-helper-text">
              Freelancer sẽ dùng email này để liên hệ. Không dùng email đăng
              nhập; để trống nếu không muốn công khai.
            </small>
          </label>
          <label className="full">
            <span className="field-label-text">
              Số điện thoại liên hệ công khai (không bắt buộc)
            </span>
            <input
              type="tel"
              value={publicContactPhone}
              maxLength={20}
              disabled={!loaded || savingProfile}
              onChange={(e) => setPublicContactPhone(e.target.value)}
              placeholder="Ví dụ: 024 1234 5678"
            />
            <small className="field-helper-text">
              Chỉ số nhập ở đây mới được công khai; không sử dụng số điện thoại
              đăng nhập của tài khoản. Để trống để ẩn.
            </small>
          </label>
          <label className="full">
            <div className="field-label-row">
              <span className="field-label-text">
                Giới thiệu doanh nghiệp và nhu cầu tuyển dụng
              </span>
              <small>{bio.length}/500 ký tự</small>
            </div>
            <textarea
              rows={5}
              value={bio}
              maxLength={500}
              disabled={!loaded || savingProfile}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Giới thiệu ngành nghề, sản phẩm, quy mô, cách làm việc và dự án cần cộng tác..."
            />
          </label>
          <div className="client-company-public-note full">
            <CheckCircle2 size={18} />
            <span>
              Thông tin doanh nghiệp ở trên sẽ được hiển thị cho Freelancer khi
              xem hồ sơ Client. Chỉ email và số điện thoại liên hệ bạn nhập ở
              trên được công khai; thông tin đăng nhập không hiển thị.
            </span>
          </div>
          <div className="form-actions full client-profile-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={!loaded || savingProfile}
              onClick={restore}
            >
              Hủy
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={!loaded || savingProfile}
              onClick={() => void handleSaveClientProfile()}
            >
              {savingProfile ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function SettingsPage({ logout: _logout }: { logout: () => void }) {
  const { role, profile, updateProfileInfo, notify } = useStore()
  const [name, setName] = useState(profile.name)
  const [phone, setPhone] = useState(profile.phone)
  const [bio, setBio] = useState(profile.bio || "")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setName(profile.name)
    setPhone(profile.phone)
    setBio(profile.bio || "")
  }, [profile.name, profile.phone, profile.bio])

  const handleSaveSettings = async () => {
    if (saving) return
    if (!name.trim()) {
      setError("Vui lòng nhập họ và tên.")
      return
    }
    if (bio.length > 500) {
      setError("Nội dung giới thiệu tối đa 500 ký tự.")
      return
    }
    if (newPassword || confirmPassword) {
      const invalid = passwordError(newPassword)
      if (invalid) {
        setError(invalid)
        return
      }
      if (newPassword !== confirmPassword) {
        setError("Xác nhận mật khẩu mới không khớp.")
        return
      }
    }
    setError("")
    setSaving(true)
    const ok = await updateProfileInfo({
      name: name.trim(),
      phone: phone.trim(),
      bio: bio.trim(),
      newPassword: newPassword || undefined,
      confirmPassword: confirmPassword || undefined,
    })
    setSaving(false)
    if (ok) {
      setNewPassword("")
      setConfirmPassword("")
      notify("Đã lưu cài đặt tài khoản thành công.")
    }
  }

  const bioPlaceholder =
    role === "Client"
      ? "Chia sẻ đôi nét về bạn, lĩnh vực hoạt động và nhu cầu tìm kiếm Freelancer cho các dự án của mình..."
      : "Giới thiệu về bản thân, kinh nghiệm, thế mạnh và lĩnh vực bạn muốn làm việc..."

  return (
    <section className="panel function-panel settings-page">
      <div className="management-head">
        <div>
          <h2>Cài đặt tài khoản</h2>
          <p>Quản lý thông tin cá nhân và bảo mật đăng nhập.</p>
        </div>
      </div>
      <div className="content-tabs">
        <button className="active">Thông tin tài khoản & bảo mật</button>
      </div>
      <div className="profile-edit">
        <AvatarUploadControl
          wrapperClassName="avatar-upload"
          buttonLabel="Thay ảnh"
        />
        <div className="form-grid">
          <label>
            <span className="field-label-text">Họ và tên *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            <span className="field-label-text">Số điện thoại</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="full">
            <span className="field-label-text">Email tài khoản</span>
            <input
              readOnly
              aria-readonly="true"
              className="readonly-field-input"
              value={profile.email}
            />
            <small className="field-helper-text">
              Email hiện không thể thay đổi.
            </small>
          </label>
          <label className="full">
            <div className="field-label-row">
              <span className="field-label-text">Giới thiệu</span>
              <small
                style={{
                  color: bio.length >= 500 ? "#ef4444" : "#6b7280",
                  fontWeight: 500,
                }}
              >
                {bio.length}/500 ký tự
              </small>
            </div>
            <textarea
              rows={5}
              value={bio}
              maxLength={500}
              onChange={(e) => setBio(e.target.value.slice(0, 500))}
              placeholder={bioPlaceholder}
            />
          </label>
          <label>
            <span className="field-label-text">Mật khẩu mới</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Từ 12–72 ký tự (bỏ trống nếu không đổi)"
            />
          </label>
          <label>
            <span className="field-label-text">Xác nhận mật khẩu</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
            />
          </label>
          {error && (
            <p className="auth-error full">
              <AlertCircle size={16} />
              {error}
            </p>
          )}
          <div className="form-actions full">
            <button
              className="secondary-button"
              disabled={saving}
              onClick={() => {
                setName(profile.name)
                setPhone(profile.phone)
                setBio(profile.bio || "")
                setNewPassword("")
                setConfirmPassword("")
                setError("")
              }}
            >
              Hủy
            </button>
            <button
              className="primary-button"
              disabled={saving}
              onClick={handleSaveSettings}
            >
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function Dashboard({
  role,
  page,
  setPage,
  onPublic,
  onLogout,

  theme,
  toggleTheme,
}: {
  role: Role
  page: string
  setPage: (page: string) => void
  onPublic: () => void
  onLogout: () => void

  theme: Theme
  toggleTheme: () => void
}) {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(
    () => sessionStorage.getItem("itlink-sidebar-collapsed") === "true",
  )
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    Math.min(
      240,
      Math.max(
        216,
        Number(sessionStorage.getItem("itlink-sidebar-width")) || 224,
      ),
    ),
  )
  const [quickQuery, setQuickQuery] = useState("")
  useEffect(
    () => sessionStorage.setItem("itlink-sidebar-collapsed", String(collapsed)),
    [collapsed],
  )
  useEffect(
    () => sessionStorage.setItem("itlink-sidebar-width", String(sidebarWidth)),
    [sidebarWidth],
  )
  const [recruitmentJob, setRecruitmentJob] = useState<number | undefined>(
    undefined,
  )
  const [recruitmentAction, setRecruitmentAction] =
    useState<"details" | "proposals" | "create">("details")
  useEffect(() => {
    if (page !== "Quản lý công việc") setRecruitmentAction("details")
  }, [page])
  const updateQuickQuery = (value: string) => {
    setQuickQuery(value)
    if (role === "Freelancer" && value) setPage("Tìm việc")
  }
  const { profile } = useStore()
  const adminUser = getSessionSnapshot().user
  const content =
    page === "Thông báo" ? (
      <NotificationPage user={getSessionSnapshot().user} navigate={setPage} />
    ) : workspacePages[page] ? (
      <IntegratedWorkspace
        initialJobId={recruitmentJob}
        role={role}
        section={workspacePages[page]}
        user={getSessionSnapshot().user}
        page={page}
        navigate={setPage}
      />
    ) : page === "Tổng quan" ? (
      <Overview
        onCreateJob={() => {
          setRecruitmentJob(undefined)
          setRecruitmentAction("create")
          setPage("Quản lý công việc")
        }}
        onOpenJob={(id, panel) => {
          setRecruitmentJob(undefined)
          setRecruitmentAction("details")
          setPage("Quản lý công việc")
          navigateClientJobs({
            jobId: id ?? null,
            invalidId: false,
            tab: panel,
            page: 0,
          })
        }}
        role={role}
        openJobs={() =>
          setPage(role === "Freelancer" ? "Tìm việc" : "Quản lý công việc")
        }
        openAssignments={() =>
          setPage(
            role === "Freelancer" ? "Công việc của tôi" : "Không gian dự án",
          )
        }
        navigateDashboard={setPage}
      />
    ) : role === "Freelancer" && page === "Tìm việc" ? (
      <DashboardJobSearch query={quickQuery} onQueryChange={setQuickQuery} />
    ) : role === "Freelancer" && page === "Việc làm đã lưu" ? (
      <SavedJobsManager
        key={getSessionSnapshot().user?.id ?? "anonymous"}
        navigateDashboard={setPage}
      />
    ) : page === "Hỗ trợ" ? (
      <SupportPage />
    ) : page === "Cài đặt tài khoản" ? (
      <SettingsPage logout={onLogout} />
    ) : role === "Freelancer" && page === "Hồ sơ của tôi" ? (
      <ProfileManager />
    ) : role === "Client" && page === "Hồ sơ của tôi" ? (
      <ClientProfileManager />
    ) : role === "Freelancer" && page === "Đề xuất đã gửi" ? (
      <ProposalManager />
    ) : page === "Công việc của tôi" ? (
      <AssignmentManager client={role === "Client"} />
    ) : page === "Quản lý công việc" ? (
      <JobManager
        admin={role === "Admin"}
        initialAction={recruitmentAction}
        initialJobId={recruitmentJob}
      />
    ) : role === "Admin" && page === "Quản lý người dùng" ? (
      <UserManager />
    ) : (
      <div className="panel function-panel">Trang n?y hi?n kh?ng kh? d?ng.</div>
    )
  const isProfilePage = page === "Hồ sơ của tôi" && role !== "Admin"
  const hidePageWelcome =
    isProfilePage ||
    (role === "Freelancer" &&
      (page === "Tổng quan" ||
        page === "Tìm việc" ||
        page === "Việc làm đã lưu" ||
        page === "Đề xuất đã gửi" ||
        page === "Công việc của tôi" ||
        page === "Không gian dự án")) ||
    (role === "Client" &&
      (page === "Tổng quan" ||
        page === "Quản lý công việc" ||
        page === "Không gian dự án"))
  const shellStyle = {
    "--sidebar-width": `${collapsed ? 70 : sidebarWidth}px`,
  } as CSSProperties
  const adminView =
    role === "Admin" ? (
      <AdminDashboard
        page={page}
        navigate={setPage}
        onPublic={onPublic}
        onLogout={onLogout}
        theme={theme}
        toggleTheme={toggleTheme}
        user={
          adminUser
            ? { ...adminUser, fullName: profile.name || adminUser.fullName }
            : null
        }
        settings={<SettingsPage logout={onLogout} />}
      />
    ) : null
  return (
    adminView ?? (
      <div
        className={`app-shell role-${role.toLowerCase()} ${
          collapsed ? "sidebar-collapsed" : ""
        }`}
        style={shellStyle}
      >
        <Sidebar
          role={role}
          page={page}
          select={(target) => {
            setPage(target)
            if (role === "Client" && target === "Quản lý công việc")
              navigateClientJobs({
                ...readClientJobRoute(),
                jobId: null,
                invalidId: false,
                tab: "details",
              })
            else if (role === "Client" && target === "Không gian dự án") {
              window.history.pushState(
                null,
                "",
                `#/dashboard/${encodeURIComponent("Không gian dự án")}`,
              )
              window.dispatchEvent(new PopStateEvent("popstate"))
            }
          }}
          close={() => setOpen(false)}
          open={open}
          collapsed={collapsed}
          toggle={() => setCollapsed(!collapsed)}
          width={sidebarWidth}
          setWidth={setSidebarWidth}
          onPublic={onPublic}
        />
        <div className="page">
          <DashboardHeader
            role={role}
            onMenu={() => setOpen(true)}
            onPublic={onPublic}
            onDashboard={() => setPage("Tổng quan")}
            onProfile={() =>
              setPage(role === "Admin" ? "Cài đặt tài khoản" : "Hồ sơ của tôi")
            }
            onSettings={() => setPage("Cài đặt tài khoản")}
            onLogout={onLogout}
            query={quickQuery}
            onQueryChange={updateQuickQuery}
            theme={theme}
            toggleTheme={toggleTheme}
            hideSearch={
              role === "Freelancer" &&
              (page === "Tìm việc" ||
                page === "Đề xuất đã gửi" ||
                page === "Việc làm đã lưu")
            }
          />
          <main className={isProfilePage ? "profile-page" : undefined}>
            {!hidePageWelcome && (
              <section className="welcome">
                <div>
                  <h1>{page}</h1>
                  {!(
                    role === "Client" &&
                    (page === "Quản lý công việc" ||
                      page === "Tổng quan" ||
                      page === "Công việc đang thực hiện" ||
                      page === "Hỗ trợ")
                  ) &&
                    !(
                      role === "Freelancer" &&
                      (page === "Hỗ trợ" ||
                        page === "Tìm việc" ||
                        page === "Công việc của tôi" ||
                        page === "Việc làm đã lưu")
                    ) && <p>Quản lý mọi hoạt động của bạn tại một nơi.</p>}
                </div>
              </section>
            )}
            {content}
          </main>
        </div>
      </div>
    )
  )
}

function SupportPage() {
  const { profile } = useStore()
  const [name, setName] = useState(profile.name || "")
  const [email, setEmail] = useState(profile.email || "")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState("")
  const [requests, setRequests] =
    useState<import("./api/support").SupportRequest[]>([])
  const [historyError, setHistoryError] = useState("")
  const [historyLoading, setHistoryLoading] = useState(true)
  const loadRequests = () => {
    setHistoryLoading(true)
    setHistoryError("")
    return supportApi
      .mine()
      .then(setRequests)
      .catch((e) =>
        setHistoryError(
          e instanceof Error ? e.message : "Không thể tải lịch sử hỗ trợ",
        ),
      )
      .finally(() => setHistoryLoading(false))
  }
  useEffect(() => {
    void loadRequests()
  }, [])
  const submitSupport = async () => {
    if (sending) return
    const input = {
      name: name.trim(),
      email: email.trim(),
      subject: subject.trim(),
      message: message.trim(),
    }
    if (!input.name || !input.email || !input.subject || !input.message) {
      setResult("Vui lòng nhập đầy đủ thông tin.")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      setResult("Email không hợp lệ.")
      return
    }
    if (
      input.name.length > 150 ||
      input.email.length > 254 ||
      input.subject.length > 200 ||
      input.message.length > 4000
    ) {
      setResult("Nội dung vượt quá giới hạn cho phép.")
      return
    }
    setSending(true)
    setResult("")
    try {
      await supportApi.submitAuthenticated(input)
      void loadRequests()
      setSubject("")
      setMessage("")
      setResult("Yêu cầu hỗ trợ đã được gửi đến Admin.")
    } catch (error) {
      setResult(
        error instanceof Error
          ? error.message
          : "Không thể gửi yêu cầu. Vui lòng thử lại.",
      )
    } finally {
      setSending(false)
    }
  }
  const faqs = [
    [
      "Làm thế nào để đăng ký và đăng nhập?",
      "Chọn Đăng ký, tạo tài khoản Freelancer hoặc Client. Khi đăng nhập, hệ thống tự xác định đúng vai trò từ tài khoản.",
    ],
    [
      "Freelancer tải CV lên như thế nào?",
      "Vào “Hồ sơ của tôi”, mở tab “CV”, chọn thêm mới và tải lên tệp PDF mới nhất.",
    ],
    [
      "Làm thế nào để tìm việc?",
      "Vào “Tìm việc”, chọn công việc phù hợp và xem mô tả chi tiết. Nếu muốn ứng tuyển, nhấn “Gửi Proposal”.",
    ],
    [
      "Làm thế nào để gửi Proposal?",
      "Mở Job đang tuyển, nhấn “Gửi Proposal”, chọn CV nếu muốn đính kèm, nhập lời giới thiệu, giá đề xuất và thời gian dự kiến. CV đã gửi được giữ nguyên cho Proposal.",
    ],
    [
      "Làm sao để đăng công việc?",
      "Đăng nhập tài khoản Client, vào “Quản lý công việc” và chọn “Đăng công việc”.",
    ],
    [
      "Client xem Proposal của ứng viên ở đâu?",
      "Mở “Quản lý công việc”, chọn Job và chuyển sang tab “Đề xuất ứng tuyển”. Trong chi tiết Proposal, Client chủ Job có thể xem hoặc tải CV nếu Freelancer đã đính kèm.",
    ],
    [
      "Quản lý Assignment như thế nào?",
      "Mở “Công việc đang thực hiện” để theo dõi thông tin, thời hạn và trạng thái của từng Assignment.",
    ],
    [
      "Làm thế nào để hoàn thành Assignment?",
      "Sau khi nghiệm thu, Client mở Assignment và chọn “Xác nhận hoàn thành”.",
    ],
    [
      "Khi nào Freelancer được đánh giá?",
      "Sau khi Client xác nhận công việc hoàn thành, Client có thể gửi đánh giá từ 1 đến 5 sao.",
    ],
    [
      "Tôi có thể chỉnh sửa thông tin cá nhân ở đâu?",
      "Nhấn avatar ở góc phải, chọn “Cài đặt tài khoản” để thay đổi thông tin hoặc mật khẩu.",
    ],
    [
      "Tôi gặp lỗi thì liên hệ ở đâu?",
      "Vào “Hỗ trợ” để xem hướng dẫn hoặc sử dụng thông tin liên hệ của nền tảng.",
    ],
  ]
  return (
    <div className="support-grid">
      <section className="panel function-panel">
        <div className="panel-heading">
          <div>
            <h2>Câu hỏi thường gặp</h2>
          </div>
        </div>
        {faqs.map(([question, answer], i) => (
          <details key={question} open={i === 0}>
            <summary>
              {question}
              <ChevronDown />
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </section>
      <section className="panel function-panel">
        <div className="panel-heading">
          <div>
            <h2>Liên hệ hỗ trợ</h2>
          </div>
        </div>
        <div className="form-grid support-form">
          <label className="support-name-label">
            Họ tên
            <input
              value={name}
              maxLength={150}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={email}
              maxLength={254}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="full">
            Chủ đề
            <input
              maxLength={200}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Nhập chủ đề"
            />
          </label>
          <label className="full">
            Nội dung
            <textarea
              rows={5}
              maxLength={4000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Mô tả vấn đề cần hỗ trợ..."
            />
          </label>
        </div>
        <button
          className="primary-button"
          type="button"
          disabled={
            sending ||
            !name.trim() ||
            !email.trim() ||
            !subject.trim() ||
            !message.trim()
          }
          onClick={() => void submitSupport()}
        >
          {sending ? "Đang gửi..." : "Gửi yêu cầu"}
        </button>
        {result && <p role="status">{result}</p>}
      </section>
      <section
        className="panel function-panel"
        style={{ gridColumn: "1 / -1", alignSelf: "start", minHeight: 0 }}
      >
        <div className="panel-heading">
          <h2>Yêu cầu hỗ trợ của tôi</h2>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void loadRequests()}
          >
            Làm mới
          </button>
        </div>
        {historyError && <p role="alert">{historyError}</p>}
        {historyLoading ? (
          <p>Đang tải yêu cầu...</p>
        ) : requests.length === 0 ? (
          <p>
            Chưa có yêu cầu nào được liên kết với tài khoản này. Các yêu cầu gửi
            trước khi cập nhật hệ thống có thể chưa xuất hiện ở đây. Hãy gửi yêu
            cầu mới khi đã đăng nhập để theo dõi phản hồi.
          </p>
        ) : (
          requests.map((item) => (
            <details key={item.id} style={{ marginBottom: 12 }}>
              <summary>
                {item.subject} ·{" "}
                {item.status === "RESOLVED"
                  ? "Đã xử lý"
                  : item.status === "IN_PROGRESS"
                    ? "Đang xử lý"
                    : "Mới"}
              </summary>
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {item.message}
              </p>
              {item.adminReply ? (
                <div
                  style={{
                    padding: 12,
                    border: "1px solid #d9e1ec",
                    borderRadius: 10,
                  }}
                >
                  <strong>Phản hồi từ Admin</strong>
                  <p
                    style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                  >
                    {item.adminReply}
                  </p>
                </div>
              ) : (
                <p>Chưa có phản hồi từ Admin.</p>
              )}
            </details>
          ))
        )}
      </section>
    </div>
  )
}

function Footer({ go }: { go?: (p: PublicPage) => void }) {
  const { loggedIn, role, navigateToDashboard, notify } = useStore()
  return (
    <footer>
      <div>
        <Logo />
        <p className="footer-slogan">Kết nối. Hợp tác. Sáng tạo.</p>
        <p>Nền tảng kết nối tài năng IT với những dự án xứng tầm.</p>
      </div>
      <div>
        <strong>Dành cho Freelancer</strong>
        <span style={{ cursor: "pointer" }} onClick={() => go?.("jobs")}>
          Tìm việc
        </span>
        <span
          style={{ cursor: "pointer" }}
          onClick={() => {
            if (loggedIn && role === "Freelancer")
              navigateToDashboard("Hồ sơ của tôi")
            else if (loggedIn)
              notify(
                "Chức năng Hồ sơ Freelancer dành cho tài khoản Freelancer.",
              )
            else go?.("register")
          }}
        >
          Xây dựng hồ sơ
        </span>
        <span
          style={{ cursor: "pointer" }}
          onClick={() => {
            if (loggedIn && role === "Freelancer")
              navigateToDashboard("Đề xuất đã gửi")
            else if (loggedIn) navigateToDashboard("Quản lý công việc")
            else go?.("login")
          }}
        >
          Quản lý Proposal
        </span>
        <span
          style={{ cursor: "pointer" }}
          onClick={() => {
            if (loggedIn && role === "Freelancer")
              navigateToDashboard("Việc làm đã lưu")
            else if (loggedIn)
              notify("Chức năng Việc làm đã lưu dành cho tài khoản Freelancer.")
            else go?.("jobs")
          }}
        >
          Việc làm đã lưu
        </span>
      </div>
      <div>
        <strong>Dành cho Client</strong>
        <span
          style={{ cursor: "pointer" }}
          onClick={() => {
            if (loggedIn && role === "Client")
              navigateToDashboard("Quản lý công việc")
            else if (loggedIn && role === "Freelancer")
              notify(
                "Vui lòng sử dụng tài khoản Client để đăng dự án tuyển dụng.",
              )
            else go?.("register")
          }}
        >
          Đăng dự án
        </span>
        <span style={{ cursor: "pointer" }} onClick={() => go?.("talents")}>
          Tìm chuyên gia
        </span>
        <span style={{ cursor: "pointer" }} onClick={() => go?.("about")}>
          Cách hoạt động
        </span>
      </div>
      <div>
        <strong>Hỗ trợ</strong>
        <span style={{ cursor: "pointer" }} onClick={() => go?.("contact")}>
          Trung tâm trợ giúp
        </span>
        <span style={{ cursor: "pointer" }} onClick={() => go?.("about")}>
          Điều khoản
        </span>
        <span style={{ cursor: "pointer" }} onClick={() => go?.("about")}>
          Bảo mật
        </span>
      </div>
    </footer>
  )
}

export default function App() {
  const authState = useSyncExternalStore(subscribeSession, getSessionSnapshot)
  const publicPages: PublicPage[] = [
    "home",
    "jobs",
    "talents",
    "profile",
    "about",
    "contact",
    "login",
    "register",
  ]
  const parseRouteHash = (
    hash: string,
    isLoggedIn: boolean,
    currentRole: Role,
  ): {
    mode: "public" | "dashboard"
    page: PublicPage
    dashboardPage: string
  } => {
    let path = "/"
    try {
      path = decodeURIComponent(hash.replace(/^#/, "").split("?")[0]) || "/"
    } catch {}
    if (path.startsWith("/dashboard")) {
      if (!isLoggedIn)
        return { mode: "public", page: "login", dashboardPage: "Tổng quan" }
      const rawRequested = path.replace(/^\/dashboard\/?/, "")
      const adminAliases: Record<string, string> = {
        "Quản lý công việc": "Quản lý Job",
        "Báo cáo": "Báo cáo & thống kê",
        "Không gian dự án": "Quản lý dự án",
      }
      if (currentRole === "Admin" && adminAliases[rawRequested])
        return {
          mode: "dashboard",
          page: "home",
          dashboardPage: adminAliases[rawRequested],
        }
      const requested =
        currentRole === "Client" && rawRequested === "Công việc đang thực hiện"
          ? "Không gian dự án"
          : currentRole === "Client" && rawRequested === "Chất lượng tin"
            ? "Quản lý công việc"
            : rawRequested
      const allowed = menus[currentRole] || []
      const known = [...allowed, "Cài đặt tài khoản", "Thông báo"]
      return {
        mode: "dashboard",
        page: "home",
        dashboardPage: known.includes(requested) ? requested : "Tổng quan",
      }
    }
    const name = path.replace(/^\//, "") as PublicPage
    return {
      mode: "public",
      page: publicPages.includes(name) ? name : "home",
      dashboardPage: "Tổng quan",
    }
  }
  const initialRoute = parseRouteHash(
    window.location.hash,
    !!authState.user,
    uiRole(authState.user) || "Freelancer",
  )
  const [mode, setMode] = useState<"public" | "dashboard">(initialRoute.mode)
  const [page, setPage] = useState<PublicPage>(initialRoute.page)
  const [dashboardPage, setDashboardPage] = useState(initialRoute.dashboardPage)
  const [loggedIn, setLoggedIn] = useState(!!authState.user)
  const [role, setRole] = useState<Role>(uiRole(authState.user) || "Freelancer")
  const [returnTo, setReturnTo] = useState<PublicPage | null>(null)
  const [selectedJobId, setSelectedJobId] = useState("")
  const [publicSearchQuery, setPublicSearchQuery] = useState("")

  const [theme, setTheme] = useState<Theme>("light")

  const [jobsState, setJobsState] = useState<JobItem[]>([])
  const [clientJobsState, setClientJobsState] = useState<JobItem[]>([])
  const [proposalsState, setProposalsState] = useState<ProposalItem[]>([])
  const [assignmentsState, setAssignmentsState] = useState<AssignmentItem[]>([])
  const [talentsState, setTalentsState] = useState<TalentItem[]>([])
  const [usersState, setUsersState] = useState<UserItem[]>([])
  const [profileState, setProfileState] = useState<FreelancerProfileData>(() =>
    createEmptyAuthenticatedProfile(),
  )
  const [assignmentFilter, setAssignmentFilter] =
    useState<AssignmentFilterTab>("Tất cả")
  const [jobFilterStatus, setJobFilterStatus] =
    useState<string>("Tất cả trạng thái")
  const [profileTab, setProfileTab] = useState<ProfileTab>("Thông tin cá nhân")
  const [selectedTalent, setSelectedTalent] = useState<TalentItem>({
    name: "",
    role: "",
    location: "",
    hourlyRate: "",
    rating: "",
    jobs: "",
    initials: "",
    category: "",
    bio: "",
    skills: [],
    portfolios: [],
  })
  const [applyingJob, setApplyingJob] = useState<JobItem | null>(null)
  const [cvPreview, setCvPreview] = useState<{
    fileName: string
    cvId: string | number | null
    blobUrl: string | null
    loading: boolean
    error: string | null
  } | null>(null)
  const cvPreviewRequest = useRef(0)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const savedJobs = useSavedJobs(authState.user)

  const savedJobIds = savedJobs.ids
  const toggleSaveJob = async (jobId: string) => {
    if (!loggedIn) {
      setReturnTo(page)
      setPage("login")
      return
    }
    const wasSaved = savedJobIds.includes(jobId)

    if (await savedJobs.toggle(jobId))
      notify(wasSaved ? "Đã bỏ lưu việc làm." : "Đã lưu việc làm.")
  }

  const isJobSaved = (jobId: string) => savedJobIds.includes(jobId)

  const openChatWith = (_partner: {
    name: string
    role?: string
    avatarUrl?: string | null
    jobId?: string
    jobTitle?: string
  }) => {
    notify("Chat nằm ngoài phạm vi sản phẩm LinkIT.")
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#111827" : "#16A34A")
  }, [theme])

  const notify = (msg: string) => {
    setToastMsg(msg)
  }

  const routeRef = useRef({ loggedIn, role })
  routeRef.current = { loggedIn, role }
  const historyInitialized = useRef(false)
  const rawWorkspaceSection = new URLSearchParams(
    window.location.hash.split("?")[1] || "",
  ).get("section")
  const workspaceSection = [
    "overview",
    "scope",
    "milestones",
    "changes",
    "risks",
    "acceptance",
  ].includes(rawWorkspaceSection || "")
    ? rawWorkspaceSection
    : null
  const routeHash =
    mode === "dashboard" && loggedIn
      ? `#/dashboard/${encodeURIComponent(dashboardPage)}${
          (role === "Admin" ||
            dashboardPage === "Đề xuất đã gửi" ||
            (role === "Freelancer" && dashboardPage === "Tìm việc")) &&
          window.location.hash.split("?")[0] ===
            `#/dashboard/${encodeURIComponent(dashboardPage)}`
            ? window.location.hash.includes("?")
              ? `?${window.location.hash.split("?")[1]}`
              : ""
            : role === "Client" && dashboardPage === "Quản lý công việc"
              ? clientJobQuery()
              : [
                    "overview",
                    "scope",
                    "milestones",
                    "changes",
                    "risks",
                    "acceptance",
                  ].includes(workspacePages[dashboardPage]) &&
                  workspaceId(window.location.hash)
                ? `?assignmentId=${workspaceId(window.location.hash)}${
                    workspaceSection ? "&section=" + workspaceSection : ""
                  }`
                : ""
        }`
      : `#/${page === "home" ? "" : page}`

  useEffect(() => {
    if (
      authState.status === "loading" ||
      authState.status === "error" ||
      (!!authState.user && !loggedIn)
    )
      return
    const normalize = (h: string) => {
      try {
        return decodeURIComponent(h) || "#/"
      } catch {
        return h || "#/"
      }
    }
    if (normalize(window.location.hash) === normalize(routeHash)) {
      historyInitialized.current = true
      return
    }
    if (
      !historyInitialized.current ||
      (role === "Client" &&
        [
          "#/dashboard/Công việc đang thực hiện",
          "#/dashboard/Chất lượng tin",
        ].includes(normalize(window.location.hash).split("?")[0]))
    ) {
      window.history.replaceState(window.history.state, "", routeHash)
      historyInitialized.current = true
    } else {
      window.history.pushState(null, "", routeHash)
    }
  }, [routeHash, authState.status, loggedIn])

  useEffect(() => {
    const onPop = () => {
      const { loggedIn: isIn, role: r } = routeRef.current
      if (r === "Client") {
        let currentPath = ""
        try {
          currentPath = decodeURIComponent(window.location.hash.split("?")[0])
        } catch {}
        if (currentPath === "#/dashboard/Công việc đang thực hiện") {
          const assignmentId = workspaceId(window.location.hash)
          window.history.replaceState(
            window.history.state,
            "",
            `#/dashboard/${encodeURIComponent("Không gian dự án")}${
              assignmentId ? `?assignmentId=${assignmentId}` : ""
            }`,
          )
        } else if (currentPath === "#/dashboard/Chất lượng tin") {
          window.history.replaceState(
            window.history.state,
            "",
            `#/dashboard/${encodeURIComponent("Quản lý công việc")}${clientJobQuery({ ...readClientJobRoute(), tab: "quality" })}`,
          )
        }
      }
      const next = parseRouteHash(window.location.hash, isIn, r)
      if (
        isIn &&
        window.location.hash.startsWith("#/dashboard/") &&
        next.dashboardPage === "Tổng quan"
      ) {
        let requested = ""
        try {
          requested = decodeURIComponent(window.location.hash)
            .split("/dashboard/")[1]
            ?.split("?")[0]
        } catch {}
        if (requested && requested !== "Tổng quan")
          notify("Bạn không có quyền truy cập trang này.")
      }
      setMode(next.mode)
      setPage(next.page)
      setDashboardPage(next.dashboardPage)
    }
    window.addEventListener("popstate", onPop)
    window.addEventListener("hashchange", onPop)
    return () => {
      window.removeEventListener("popstate", onPop)
      window.removeEventListener("hashchange", onPop)
    }
  }, [])

  const closeCvPreview = () => {
    cvPreviewRequest.current += 1
    setCvPreview((prev) => {
      if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl)
      return null
    })
  }

  const navigateToDashboard = (targetPage: string) => {
    const legacyQuality = role === "Client" && targetPage === "Chất lượng tin"
    if (legacyQuality) targetPage = "Quản lý công việc"
    if (role === "Client" && targetPage === "Công việc đang thực hiện")
      targetPage = "Không gian dự án"
    if (!loggedIn) {
      setMode("public")
      setPage("login")
      return
    }
    if (
      !canUseDashboard(authState.user, role) ||
      ![...menus[role], "Cài đặt tài khoản", "Thông báo"].includes(targetPage)
    ) {
      notify("Bạn không có quyền truy cập trang này.")
      return
    }
    setDashboardPage(targetPage)
    setMode("dashboard")
    if (legacyQuality)
      navigateClientJobs({ ...readClientJobRoute(), tab: "quality" })
  }

  const fetchJobs = useCallback(async () => {
    if (!getAccessToken()) return
    const epoch = sessionGeneration()
    try {
      const result = await jobApi.search({ page: 0, size: 6 })
      if (epoch !== sessionGeneration()) return
      const mapped = result.content.map(mapJobDtoToItem)
      setJobsState(mapped)
      setSelectedJobId((previous) => previous || mapped[0]?.id || "")
    } catch (e) {
      if (epoch !== sessionGeneration()) return
      setJobsState([])
      notify(e instanceof Error ? e.message : "Không thể tải Job.")
    }
  }, [])
  useEffect(() => {
    if (authState.user && page === "home") void fetchJobs()
  }, [authState.user, page, fetchJobs])

  const refreshClientData = useCallback(async () => {
    if (!getAccessToken()) return
    const epoch = sessionGeneration()
    try {
      const result = await jobApi.mine(0, 100)
      if (epoch !== sessionGeneration()) return
      setClientJobsState(result.content.map(mapJobDtoToItem))
    } catch (e) {
      if (epoch !== sessionGeneration()) return
      setClientJobsState([])
      notify(e instanceof Error ? e.message : "Không thể tải Job.")
    }
  }, [])

  useEffect(() => {
    if (
      authState.status !== "authenticated" ||
      !authState.user?.roles.includes("CLIENT") ||
      role !== "Client"
    )
      return
    let active = true
    userApi
      .me()
      .then((saved) => {
        if (!active) return
        setProfileState((prev) => ({
          ...prev,
          name: saved.fullName,
          shortName: saved.fullName.trim().split(/\s+/).slice(-2).join(" "),
          initials: toInitials(saved.fullName),
          email: saved.email,
          phone: saved.phoneNumber ?? "",
          bio: saved.bio ?? "",
          title: saved.title ?? "",
        }))
      })
      .catch((error) => {
        if (active)
          notify(
            error instanceof Error
              ? error.message
              : "Không thể tải hồ sơ Client.",
          )
      })
    return () => {
      active = false
    }
  }, [authState.status, authState.user, role])

  const refreshFreelancerData = useCallback(async () => {
    if (!getAccessToken()) return false
    const epoch = sessionGeneration()
    try {
      const fp = await freelancerApi.me()
      if (epoch !== sessionGeneration()) return false
      const parts = (fp.fullName || "User").trim().split(/\s+/)
      setProfileState((prev) => ({
        ...prev,
        name: fp.fullName || prev.name,
        shortName: parts.slice(-2).join(" "),
        initials: toInitials(fp.fullName),
        title: fp.title ?? prev.title ?? "",
        email: fp.email || prev.email,
        phone: fp.phoneNumber || prev.phone || "",
        bio: fp.bio ?? "",
        avatarUrl: fp.avatarUrl ?? prev.avatarUrl,
        skills: (fp.skills || []).map((s) => ({
          id: String(s.id),
          title: s.name,
          updatedAt: "Đã đồng bộ",
        })),
        experiences: (fp.workExperiences || []).map((w) => ({
          id: String(w.id),
          title: `${w.position} · ${w.companyName}`,
          updatedAt: formatDateUi(w.startDate),
          work: w,
        })),
        portfolios: (fp.portfolioProjects || []).map((p) => ({
          id: String(p.id),
          title: p.title,
          updatedAt: p.technologies || "Đã đồng bộ",
          portfolio: p,
        })),
        cvs: (fp.cvs || []).map((c) => ({
          id: String(c.id),
          title: c.fileName,
          updatedAt: `PDF · ${formatDateUi(c.uploadedAt)}`,
          fileUrl: c.fileUrl,
        })),
        reviews: (fp.reviews || []).map((r) => ({
          id: String(r.id),
          assignmentId: String(r.assignmentId),
          jobTitle:
            r.jobTitle ||
            `Assignment #AS-${String(r.assignmentId).padStart(4, "0")}`,
          company: r.companyName || "",
          rating: r.rating,
          comment: r.comment || "",
          createdAt: formatDateUi(r.createdAt),
        })),
        averageRating: fp.averageRating ?? 0,
        completedJobs: fp.completedJobs ?? 0,
      }))
      return true
    } catch (err) {
      if (epoch !== sessionGeneration()) return false
      notify(
        `Không thể tải hồ sơ Freelancer: ${
          err instanceof Error ? err.message : "Lỗi kết nối API"
        }. Vui lòng kiểm tra quyền tài khoản và đăng nhập lại nếu cần.`,
      )
      return false
    }
  }, [jobsState])

  const refreshAdminData = useCallback(async () => {
    if (!getAccessToken()) return
    const epoch = sessionGeneration()
    try {
      const allUsers = await adminApi.users()
      if (epoch !== sessionGeneration()) return
      setUsersState(allUsers.map(mapUserDtoToItem))
    } catch {}
    try {
      const adminJobsPage = await adminApi.jobs(0, 100)
      if (epoch !== sessionGeneration()) return
      const mappedAdminJobs = adminJobsPage.content.map((j, idx) =>
        mapJobDtoToItem(j, idx),
      )
      setJobsState(mappedAdminJobs)
    } catch {}
  }, [jobsState])

  useEffect(() => {
    void initializeSession()
  }, [])
  useEffect(() => {
    const user = authState.user
    if (authState.status === "authenticated" && user) {
      const actualRole = uiRole(user)
      if (!actualRole) return
      setRole(actualRole)
      setLoggedIn(true)
      setProfileState(
        createEmptyAuthenticatedProfile({
          fullName: user.fullName,
          email: user.email,
          phone: user.phoneNumber || "",
          avatarUrl: user.avatarUrl,
        }),
      )
      const next = parseRouteHash(window.location.hash, true, actualRole)
      if (window.location.hash.startsWith("#/dashboard/")) {
        let requested = ""
        try {
          requested = decodeURIComponent(window.location.hash)
            .split("/dashboard/")[1]
            ?.split("?")[0]
        } catch {}
        if (
          requested &&
          !(
            actualRole === "Admin" &&
            ["Quản lý công việc", "Báo cáo", "Không gian dự án"].includes(
              requested,
            )
          ) &&
          !(
            actualRole === "Client" &&
            ["Công việc đang thực hiện", "Chất lượng tin"].includes(requested)
          ) &&
          ![...menus[actualRole], "Cài đặt tài khoản", "Thông báo"].includes(
            requested,
          )
        )
          notify("Bạn không có quyền truy cập trang này.")
      }
      if (window.location.hash.startsWith("#/dashboard")) {
        setMode(next.mode)
        setDashboardPage(next.dashboardPage)
      }
    } else if (authState.status !== "loading") {
      setLoggedIn(false)
      setProfileState(createEmptyAuthenticatedProfile())
      setClientJobsState([])
      setProposalsState([])
      setAssignmentsState([])
      setUsersState([])
      setApplyingJob(null)
      if (
        mode === "dashboard" ||
        window.location.hash.startsWith("#/dashboard")
      ) {
        setMode("public")
        setPage("login")
      }
      if (authState.error) notify(authState.error)
    }
  }, [authState])

  const store: AppStore = {
    loggedIn,

    role,
    jobs: jobsState,
    clientJobs: clientJobsState,
    proposals: proposalsState,
    assignments: assignmentsState,
    talents: talentsState,
    users: usersState,
    profile: profileState,
    assignmentFilter,
    setAssignmentFilter,
    jobFilterStatus,
    setJobFilterStatus,
    profileTab,
    setProfileTab,
    selectedTalent,
    setSelectedTalent,
    navigateToDashboard,
    openApplyModal: (job) => {
      if (!loggedIn) {
        setReturnTo("jobs")
        setPage("login")
        notify("Vui lòng đăng nhập tài khoản Freelancer để gửi Proposal.")
        return
      }
      if (role !== "Freelancer") {
        notify("Chỉ tài khoản Freelancer mới có thể gửi Proposal ứng tuyển.")
        return
      }
      if (job.status !== "Đang mở") {
        notify("Công việc này hiện không còn nhận ứng tuyển.")
        return
      }
      const existing = proposalsState.find(
        (p) =>
          String(p.jobId) === String(job.id) && p.statusKey !== "withdrawn",
      )
      if (existing) {
        notify("Bạn đã ứng tuyển công việc này rồi.")
        return
      }
      setApplyingJob(job)
    },
    submitProposal: async (jobId, cv, price, duration, cover) => {
      {
        notify("Vui lòng dùng form Proposal hiện tại.")
        return false
      }
    },
    withdrawProposal: (proposalId) => {
      {
        navigateToDashboard("Đề xuất đã gửi")
        return
      }
    },
    acceptProposal: (jobId, proposalId, candidateName) => {
      {
        navigateToDashboard("Quản lý công việc")
        return
      }
    },
    rejectProposal: (proposalId) => {
      {
        navigateToDashboard("Quản lý công việc")
        return
      }
    },
    saveJob: async (data) => {
      {
        notify("Vui lòng dùng form quản lý Job hiện tại.")
        return false
      }
    },
    closeJob: (jobId) => {
      {
        notify("Vui lòng hủy Job trong màn hình quản lý Job.")
        return
      }
    },
    completeAssignment: (assignmentId) => {
      {
        navigateToDashboard("Không gian dự án")
        const id = parseNumericId(assignmentId)
        if (id != null) openWorkspace(id)
        return
      }
    },
    cancelAssignment: (assignmentId) => {
      {
        notify(
          "Chức năng hủy dự án chưa được backend hỗ trợ. Trạng thái dự án chưa thay đổi.",
        )
        return
      }
    },
    rateAssignment: (assignmentId, rating, comment) => {
      {
        navigateToDashboard("Không gian dự án")
        const id = parseNumericId(assignmentId)
        if (id != null) openWorkspace(id)
        return
      }
    },
    toggleUserLock: (userId) => {
      const numericId = parseNumericId(userId)
      const targetUser = usersState.find((u) => u.id === userId)
      if (!targetUser) return
      const isCurrentlyActive = targetUser.status === "Đang hoạt động"
      const nextStatus: "Đang hoạt động" | "Đã khóa" = isCurrentlyActive
        ? "Đã khóa"
        : "Đang hoạt động"
      if (numericId != null && getAccessToken()) {
        void (async () => {
          try {
            if (isCurrentlyActive) {
              await adminApi.lockUser(numericId)
            } else {
              await adminApi.unlockUser(numericId)
            }
            setUsersState((prev) =>
              prev.map((u) =>
                u.id === userId ? { ...u, status: nextStatus } : u,
              ),
            )
            void refreshAdminData()
            notify(
              `Đã cập nhật trạng thái tài khoản ${targetUser.name}: ${nextStatus}.`,
            )
          } catch (err) {
            notify(
              err instanceof Error
                ? err.message
                : "Không thể cập nhật trạng thái người dùng.",
            )
          }
        })()
        return
      }
      setUsersState((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: nextStatus } : u)),
      )
      notify(
        `Đã cập nhật trạng thái tài khoản ${targetUser.name}: ${nextStatus}.`,
      )
    },
    updateProfileInfo: async (patch) => {
      if (!getAccessToken()) {
        notify("Vui lòng đăng nhập lại để lưu hồ sơ.")
        return false
      }
      const fullName = patch.name || profileState.name
      const title = patch.title !== undefined ? patch.title : profileState.title
      const phoneNumber = patch.phone ?? profileState.phone
      const bio = patch.bio ?? profileState.bio
      const avatarUrl = patch.avatarUrl ?? profileState.avatarUrl
      if (
        getAccessToken() &&
        (patch.name ||
          patch.title !== undefined ||
          patch.phone !== undefined ||
          patch.bio !== undefined ||
          patch.avatarUrl !== undefined ||
          patch.newPassword)
      ) {
        try {
          if (patch.newPassword || role !== "Freelancer") {
            await userApi.updateMe({
              fullName,
              title,
              phoneNumber,
              bio,
              avatarUrl,
              newPassword: patch.newPassword,
              confirmPassword: patch.confirmPassword,
            })
          } else {
            await freelancerApi.updateMe({
              fullName,
              title,
              phoneNumber,
              bio,
              avatarUrl,
            })
          }
        } catch (err) {
          notify(
            err instanceof Error
              ? err.message
              : "Không thể cập nhật thông tin tài khoản.",
          )
          return false
        }
      }
      setProfileState((prev) => {
        const next = { ...prev, ...patch }
        if (patch.name) {
          const parts = patch.name.trim().split(/\s+/)
          next.shortName = parts.slice(-2).join(" ")
          next.initials = toInitials(patch.name)
        }
        return next
      })
      if (patch.bio !== undefined || patch.name || patch.title !== undefined) {
        const prevName = profileState.name
        const nextName = patch.name ? patch.name.trim() : prevName
        const nextBio = patch.bio !== undefined ? patch.bio : profileState.bio
        const nextTitle =
          patch.title !== undefined ? patch.title.trim() : profileState.title
        setTalentsState((prev) =>
          prev.map((t) =>
            t.name === prevName || t.name === nextName
              ? {
                  ...t,
                  name: nextName,
                  initials: toInitials(nextName),
                  bio: nextBio,
                  role: nextTitle || t.role,
                }
              : t,
          ),
        )
        setSelectedTalent((prev) =>
          prev.name === prevName || prev.name === nextName
            ? {
                ...prev,
                name: nextName,
                initials: toInitials(nextName),
                bio: nextBio,
                role: nextTitle || prev.role,
              }
            : prev,
        )
      }
      if (role === "Freelancer") void refreshFreelancerData()
      if (role === "Client") void refreshClientData()
      return true
    },
    uploadAvatarFile: async (file) => {
      {
        if (!getAccessToken()) {
          notify("Vui lòng đăng nhập để lưu ảnh đại diện.")
          return false
        }
        try {
          const updated = await userApi.uploadAvatar(file)
          if (!updated.avatarUrl)
            throw new Error("Máy chủ chưa xác nhận ảnh đại diện đã lưu.")
          const persisted = await authApi.me()
          if (
            persisted.id !== updated.id ||
            persisted.avatarUrl !== updated.avatarUrl
          )
            throw new Error("Không thể xác nhận ảnh đại diện đã lưu.")
          const nextAvatarUrl = `${persisted.avatarUrl}?v=${Date.now()}`
          setProfileState((prev) => ({
            ...prev,
            avatarUrl: nextAvatarUrl,
          }))
          notify("Đã cập nhật ảnh đại diện thành công!")
          return true
        } catch (err) {
          notify(
            `Không thể lưu ảnh đại diện: ${
              err instanceof Error ? err.message : "Máy chủ không phản hồi."
            }`,
          )
          return false
        }
      }
      const localUrl = URL.createObjectURL(file)
      setProfileState((prev) => ({ ...prev, avatarUrl: localUrl }))
      notify("Đã cập nhật ảnh đại diện thành công!")
      return true
    },
    uploadCvFile: async (file) => {
      const sub = "PDF · Cập nhật hôm nay"
      if (!getAccessToken() || role !== "Freelancer") {
        notify("Vui lòng đăng nhập bằng tài khoản Freelancer để tải CV.")
        return null
      }
      if (
        !file.name.toLowerCase().endsWith(".pdf") ||
        !file.size ||
        file.size > 2 * 1024 * 1024 ||
        file.name.length > 255
      ) {
        notify(
          "Vui lòng chọn PDF không rỗng, tối đa 2 MB, tên tệp tối đa 255 ký tự.",
        )
        return null
      }
      if (getAccessToken() && role === "Freelancer") {
        try {
          const uploaded = await cvApi.upload(file)
          const item = {
            id: String(uploaded.id),
            title: uploaded.fileName,
            updatedAt: sub,
            fileUrl: uploaded.fileUrl,
          }
          setProfileState((prev) => ({ ...prev, cvs: [...prev.cvs, item] }))
          notify(`Đã tải lên tệp CV "${uploaded.fileName}" thành công.`)
          return { id: String(uploaded.id), title: uploaded.fileName }
        } catch (err) {
          notify(
            err instanceof Error
              ? err.message
              : "Không thể tải tệp CV lên máy chủ.",
          )
          return null
        }
      }
      const item = { id: `cv-${Date.now()}`, title: file.name, updatedAt: sub }
      setProfileState((prev) => ({ ...prev, cvs: [...prev.cvs, item] }))
      notify(`Đã tải lên tệp CV "${file.name}" thành công.`)
      return { id: item.id, title: item.title }
    },
    openCvPreview: async (cvId, fileName) => {
      const numericId = parseNumericId(cvId)
      if (numericId == null) {
        notify("Tệp CV này không tồn tại trên máy chủ hoặc chỉ là dữ liệu mẫu.")
        return
      }
      const request = ++cvPreviewRequest.current
      if (cvPreview?.blobUrl) {
        URL.revokeObjectURL(cvPreview.blobUrl)
      }
      setCvPreview({
        fileName,
        cvId: numericId,
        blobUrl: null,
        loading: true,
        error: null,
      })
      try {
        const blob = await cvApi.downloadBlob(numericId)
        if (request !== cvPreviewRequest.current) return
        const pdfBlob =
          blob.type === "application/pdf"
            ? blob
            : new Blob([blob], { type: "application/pdf" })
        const blobUrl = URL.createObjectURL(pdfBlob)
        setCvPreview({
          fileName,
          cvId: numericId,
          blobUrl,
          loading: false,
          error: null,
        })
      } catch (err) {
        if (request !== cvPreviewRequest.current) return
        const errMsg =
          err instanceof Error
            ? err.message
            : "Không thể tải tệp CV từ máy chủ."
        setCvPreview({
          fileName,
          cvId: numericId,
          blobUrl: null,
          loading: false,
          error: errMsg,
        })
        notify(errMsg)
      }
    },
    downloadCvFile: async (cvId, fileName) => {
      const numericId = parseNumericId(cvId)
      if (numericId == null) {
        notify("Tệp CV này không tồn tại trên máy chủ nên không thể tải xuống.")
        return
      }
      try {
        const blob = await cvApi.downloadBlob(numericId)
        const pdfBlob =
          blob.type === "application/pdf"
            ? blob
            : new Blob([blob], { type: "application/pdf" })
        const url = URL.createObjectURL(pdfBlob)
        const link = document.createElement("a")
        link.href = url
        link.download = fileName.toLowerCase().endsWith(".pdf")
          ? fileName
          : `${fileName}.pdf`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        notify(`Đã tải xuống tệp CV "${link.download}" thành công.`)
      } catch (err) {
        notify(
          err instanceof Error
            ? err.message
            : "Không thể tải xuống tệp CV từ máy chủ.",
        )
      }
    },
    upsertProfileRecord: async (
      tab,
      title,
      editId,
      file,
      skillDetails,
      recordDetails,
    ) => {
      const key =
        tab === "CV"
          ? "cvs"
          : tab === "Kỹ năng"
            ? "skills"
            : tab === "Kinh nghiệm làm việc"
              ? "experiences"
              : "portfolios"
      if (!getAccessToken() || role !== "Freelancer") {
        notify("Vui lòng đăng nhập bằng tài khoản Freelancer để lưu hồ sơ.")
        return false
      }
      const sub = tab === "CV" ? "PDF · Cập nhật hôm nay" : "Cập nhật hôm nay"
      const numericEditId = parseNumericId(editId)
      if (getAccessToken() && role === "Freelancer") {
        try {
          if (tab === "Kinh nghiệm làm việc") {
            if (!recordDetails?.work)
              throw new Error("Thiếu thông tin kinh nghiệm làm việc.")
            if (numericEditId != null) {
              const updated = await workExperienceApi.update(
                numericEditId,
                recordDetails.work,
              )
              setProfileState((prev) => ({
                ...prev,
                experiences: prev.experiences.map((item) =>
                  item.id === editId
                    ? {
                        ...item,
                        title: `${updated.position} · ${updated.companyName}`,
                        updatedAt: sub,
                        work: updated,
                      }
                    : item,
                ),
              }))
              notify(`Đã cập nhật ${tab} thành công.`)
              return
            } else {
              const created = await workExperienceApi.create(recordDetails.work)
              setProfileState((prev) => ({
                ...prev,
                experiences: [
                  ...prev.experiences,
                  {
                    id: String(created.id),
                    title: `${created.position} · ${created.companyName}`,
                    updatedAt: sub,
                    work: created,
                  },
                ],
              }))
              notify(`Đã thêm mới ${tab} thành công.`)
              return
            }
          } else if (tab === "Portfolio") {
            if (!recordDetails?.portfolio)
              throw new Error("Thiếu thông tin dự án.")
            if (numericEditId != null) {
              const updated = await portfolioApi.update(
                numericEditId,
                recordDetails.portfolio,
              )
              setProfileState((prev) => ({
                ...prev,
                portfolios: prev.portfolios.map((item) =>
                  item.id === editId
                    ? {
                        ...item,
                        title: updated.title,
                        updatedAt: sub,
                        portfolio: updated,
                      }
                    : item,
                ),
              }))
              notify(`Đã cập nhật ${tab} thành công.`)
              return
            } else {
              const created = await portfolioApi.create(recordDetails.portfolio)
              setProfileState((prev) => ({
                ...prev,
                portfolios: [
                  ...prev.portfolios,
                  {
                    id: String(created.id),
                    title: created.title,
                    updatedAt: sub,
                    portfolio: created,
                  },
                ],
              }))
              notify(`Đã thêm mới ${tab} thành công.`)
              return
            }
          } else if (tab === "Kỹ năng") {
            const input = {
              name: title,
              proficiency: skillDetails?.proficiency ?? 1,
              yearsExperience: skillDetails?.yearsExperience ?? 0,
            }
            const savedSkill =
              numericEditId != null
                ? await skillApi.updateMine(numericEditId, input)
                : await skillApi.addMineByName(input)
            setProfileState((prev) => {
              const filtered = editId
                ? prev.skills.filter((s) => s.id !== editId)
                : prev.skills.filter((s) => s.id !== String(savedSkill.id))
              return {
                ...prev,
                skills: [
                  ...filtered,
                  {
                    id: String(savedSkill.id),
                    title: savedSkill.name,
                    proficiency: savedSkill.proficiency,
                    yearsExperience: savedSkill.yearsExperience,
                    updatedAt: sub,
                  },
                ],
              }
            })
            notify(
              editId
                ? `Đã cập nhật ${tab} thành công.`
                : `Đã thêm mới kỹ năng "${savedSkill.name}" vào hồ sơ.`,
            )
            return
          } else if (tab === "CV" && !numericEditId) {
            if (!file) {
              notify("Vui lòng chọn tệp CV định dạng PDF từ máy tính.")
              return
            }
            const uploaded = await cvApi.upload(file)
            setProfileState((prev) => ({
              ...prev,
              cvs: [
                ...prev.cvs,
                {
                  id: String(uploaded.id),
                  title: uploaded.fileName,
                  updatedAt: sub,
                  fileUrl: uploaded.fileUrl,
                },
              ],
            }))
            if (role === "Freelancer") void refreshFreelancerData()
            notify(`Đã tải lên ${tab} "${uploaded.fileName}" thành công.`)
            return
          }
        } catch (err) {
          notify(
            err instanceof Error
              ? err.message
              : `Không thể lưu ${tab} lên máy chủ.`,
          )
          return false
        }
      }
      setProfileState((prev) => {
        const list = prev[key]
        const updated = editId
          ? list.map((item) =>
              item.id === editId ? { ...item, title, updatedAt: sub } : item,
            )
          : [...list, { id: `${key}-${Date.now()}`, title, updatedAt: sub }]
        return { ...prev, [key]: updated }
      })
      if (role === "Freelancer") void refreshFreelancerData()
      notify(
        editId
          ? `Đã cập nhật ${tab} thành công.`
          : `Đã thêm mới ${tab} thành công.`,
      )
    },
    deleteProfileRecord: async (tab, id) => {
      const key =
        tab === "CV"
          ? "cvs"
          : tab === "Kỹ năng"
            ? "skills"
            : tab === "Kinh nghiệm làm việc"
              ? "experiences"
              : "portfolios"
      const numericId = parseNumericId(id)
      if (!getAccessToken() || role !== "Freelancer" || numericId == null) {
        notify(
          "Không thể xóa dữ liệu: cần đăng nhập Freelancer và mã bản ghi hợp lệ.",
        )
        return false
      }
      try {
        if (numericId != null) {
          if (tab === "Kỹ năng") await skillApi.removeMine(numericId)
          if (tab === "Kinh nghiệm làm việc") {
            const entry = profileState.experiences.find(
              (record) => record.id === id,
            )?.work
            if (!entry)
              throw new Error(
                "Vui lòng tải lại dữ liệu trước khi xóa kinh nghiệm.",
              )
            await workExperienceApi.remove(numericId, entry.version)
          }
          if (tab === "Portfolio") {
            const entry = profileState.portfolios.find(
              (record) => record.id === id,
            )?.portfolio
            if (!entry)
              throw new Error("Vui lòng tải lại dữ liệu trước khi xóa dự án.")
            await portfolioApi.remove(numericId, entry.version)
          }
          if (tab === "CV") await cvApi.remove(numericId)
        }
        if (tab === "CV" && numericId != null && cvPreview?.cvId === numericId)
          closeCvPreview()
        setProfileState((prev) => ({
          ...prev,
          [key]: prev[key].filter((item) => String(item.id) !== String(id)),
        }))
        void refreshFreelancerData()
        notify(
          tab === "CV"
            ? "Đã xóa tệp CV khỏi hồ sơ thành công."
            : "Đã xóa mục khỏi " + tab + ".",
        )
        return true
      } catch (err) {
        notify(
          err instanceof Error
            ? err.message
            : "Không thể xóa mục khỏi " + tab + ".",
        )
        return false
      }
    },
    refreshJobs: fetchJobs,
    refreshClientData,
    refreshFreelancerData,
    refreshAdminData,
    notify,
    savedJobIds,
    savedJobRecords: savedJobs.records,
    savedJobsLoading: savedJobs.loading,
    savedJobsError: savedJobs.error,
    savedJobsReady: savedJobs.ready,
    savedJobPendingIds: savedJobs.pending,
    refreshSavedJobs: savedJobs.refresh,
    toggleSaveJob,
    isJobSaved,
    openChatWith,
  }

  const toggleTheme = () =>
    setTheme((current) => (current === "dark" ? "light" : "dark"))
  const openJobs = (id?: string) => {
    if (id) setSelectedJobId(id)
    setPage("jobs")
    setMode("public")
  }
  const handleHeroSearch = (q: string) => {
    setPublicSearchQuery(q)
    setPage("jobs")
    setMode("public")
  }
  const handlePostProject = () => {
    if (loggedIn && role === "Client") {
      setDashboardPage("Quản lý công việc")
      setMode("dashboard")
    } else if (loggedIn && role === "Freelancer") {
      notify("Chức năng Đăng dự án dành cho tài khoản Client.")
    } else if (loggedIn && role === "Admin") {
      setDashboardPage("Quản lý Job")
      setMode("dashboard")
    } else {
      setPage("register")
    }
  }
  const login = (user: AuthUser) => {
    const actualRole = uiRole(user)
    if (!actualRole) {
      notify("Tài khoản không có quyền truy cập.")
      return
    }
    setRole(actualRole)

    setLoggedIn(true)
    setProfileState(
      createEmptyAuthenticatedProfile({
        fullName: user.fullName,
        email: user.email,
        phone: user.phoneNumber || "",
        avatarUrl: user.avatarUrl,
      }),
    )
    setProposalsState([])
    setAssignmentsState([])
    setClientJobsState([])
    setAssignmentFilter("Tất cả")
    setJobFilterStatus("Tất cả trạng thái")
    setProfileTab("Thông tin cá nhân")
    setDashboardPage("Tổng quan")
    if (returnTo) {
      setMode("public")
      setPage(returnTo)
      setReturnTo(null)
    } else setMode("dashboard")
  }
  const logout = async () => {
    setLoggedIn(false)
    setMode("public")
    setPage("login")

    setProfileState(createEmptyAuthenticatedProfile())
    setClientJobsState([])
    setProposalsState([])
    setAssignmentsState([])
    setUsersState([])
    setJobsState([])
    setTalentsState([])
    setAssignmentFilter("Tất cả")
    setJobFilterStatus("Tất cả trạng thái")
    setProfileTab("Thông tin cá nhân")
    setDashboardPage("Tổng quan")
    if (!(await authApi.logout()))
      notify(
        "Đã xóa phiên trên thiết bị; chưa xác nhận thu hồi phiên trên máy chủ do lỗi kết nối.",
      )
  }

  return (
    <StoreContext.Provider value={store}>
      {mode === "dashboard" &&
      loggedIn &&
      canUseDashboard(authState.user, role) ? (
        <Dashboard
          role={role}
          page={dashboardPage}
          setPage={navigateToDashboard}
          onPublic={() => {
            setPage("home")
            setMode("public")
          }}
          onLogout={logout}
          theme={theme}
          toggleTheme={toggleTheme}
        />
      ) : (
        <div className={`public-shell page-${page}`}>
          <PublicHeader
            page={page}
            go={setPage}
            loggedIn={loggedIn}
            role={role}
            openDashboard={(targetPage) => {
              if (loggedIn) {
                if (targetPage) setDashboardPage(targetPage)
                setMode("dashboard")
              } else {
                setPage("login")
              }
            }}
            logout={logout}
            theme={theme}
            toggleTheme={toggleTheme}
          />
          {page === "home" ? (
            <Landing
              go={setPage}
              openJob={openJobs}
              onSearchJobs={handleHeroSearch}
              onPostProject={handlePostProject}
            />
          ) : page === "jobs" ? (
            <PublicListing
              type="jobs"
              go={setPage}
              selectedJobId={selectedJobId}
              initialQuery={publicSearchQuery}
              loggedIn={loggedIn}
              requireLogin={() => {
                setReturnTo("jobs")
                setPage("login")
              }}
            />
          ) : page === "talents" ? (
            <PublicListing type="talents" go={setPage} />
          ) : page === "profile" ? (
            <PublicFreelancerDetail go={setPage} />
          ) : page === "about" ? (
            <AboutPage />
          ) : page === "contact" ? (
            <AboutPage contact />
          ) : page === "login" ? (
            <AuthPage go={setPage} openDashboard={login} />
          ) : (
            <AuthPage register go={setPage} openDashboard={login} />
          )}
          {page !== "login" && page !== "register" && <Footer go={setPage} />}
        </div>
      )}
      {applyingJob && (
        <ProposalSubmitModal
          job={applyingJob}
          close={() => setApplyingJob(null)}
        />
      )}
      {cvPreview &&
        createPortal(
          <div className="modal-backdrop" onMouseDown={closeCvPreview}>
            <div
              className="panel function-panel"
              style={{
                width: "min(900px, 95vw)",
                height: "min(86vh, 820px)",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="record-header" style={{ marginBottom: 0 }}>
                <div>
                  <h2>Xem tệp CV: {cvPreview.fileName}</h2>
                  <p>Tài liệu PDF đính kèm từ hệ thống LinkIT</p>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginLeft: "auto",
                  }}
                >
                  {cvPreview.cvId != null && (
                    <button
                      className="secondary-button"
                      onClick={() =>
                        void store.downloadCvFile(
                          cvPreview.cvId,
                          cvPreview.fileName,
                        )
                      }
                    >
                      Tải xuống PDF
                    </button>
                  )}
                  <button className="secondary-button" onClick={closeCvPreview}>
                    Đóng
                  </button>
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  borderRadius: "12px",
                  overflow: "hidden",
                  border: "1px solid var(--border, #e5e7eb)",
                  background: "#f9fafb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {cvPreview.loading ? (
                  <div className="proposal-empty">
                    <LoaderCircle className="spin" />
                    <strong>Đang tải tệp CV PDF từ máy chủ...</strong>
                  </div>
                ) : cvPreview.error ? (
                  <div className="proposal-empty">
                    <AlertCircle />
                    <strong>Không thể hiển thị tệp CV</strong>
                    <span>{cvPreview.error}</span>
                  </div>
                ) : cvPreview.blobUrl ? (
                  <iframe
                    src={cvPreview.blobUrl}
                    title={`CV ${cvPreview.fileName}`}
                    style={{ width: "100%", height: "100%", border: "none" }}
                  />
                ) : null}
              </div>
            </div>
          </div>,
          document.body,
        )}
      {toastMsg &&
        createPortal(
          <Toast text={toastMsg} close={() => setToastMsg(null)} />,
          document.body,
        )}
    </StoreContext.Provider>
  )
}
