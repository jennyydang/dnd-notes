import {
  Archive, ArchiveRestore, Backpack, Bell, ChevronLeft, ChevronRight, BookOpen, Brain, Bug, Calendar, ChartBar, CircleHelp, Clipboard, ClipboardList, Coins, Compass,
  Crown, Dices, Download, Eye, Feather, File, FileText, Flame, Gem, GripVertical, Handshake, Heart, Hourglass, House, IdCard,
  Image, Inbox, LayoutGrid, Library, Lightbulb, Link, ListTodo, Lock, Map, MapPin, Menu, Maximize, MessageCircle, MessageSquare, Mic, Minus, Bookmark, Move, Square, Undo2, Upload,
  NotebookPen, Pause, PawPrint, Pencil, Pin, Play, Plus, RefreshCw, Rows3, ScrollText, Search, Send, Shield, ShieldCheck, Skull,
  Sparkles, Speech, SquareCheck, Star, Swords, Target, Trash2, TrendingUp, TriangleAlert, User, Users, VenetianMask, WifiOff, Wrench, X, Zap,
  ZoomIn, Check, Vote, Network, ListTree,
} from 'lucide-react'

// The app's icon set (Grimoire: no emoji in the UI). Line icons from
// Lucide drawn at the design system's spec — 24px grid, 1.5px stroke,
// round joins — in currentColor, so they take the text or status colour
// they sit next to. Always decorative: pair each with a visible word.
const ICONS = {
  alert: TriangleAlert,
  backpack: Backpack,
  bell: Bell,
  book: BookOpen,
  bookmark: Bookmark,
  brain: Brain,
  bug: Bug,
  calendar: Calendar,
  chart: ChartBar,
  character: VenetianMask,
  chat: MessageSquare,
  check: Check,
  'check-square': SquareCheck,
  clipboard: Clipboard,
  close: X,
  coins: Coins,
  compass: Compass,
  creature: PawPrint,
  crown: Crown,
  subtasks: ListTree,
  vote: Vote,
  network: Network,
  dice: Dices,
  download: Download,
  edit: Pencil,
  eye: Eye,
  feather: Feather,
  file: File,
  'file-text': FileText,
  flame: Flame,
  gem: Gem,
  grid: LayoutGrid,
  grip: GripVertical,
  handshake: Handshake,
  heart: Heart,
  help: CircleHelp,
  home: House,
  hourglass: Hourglass,
  id: IdCard,
  image: Image,
  inbox: Inbox,
  archive: Archive,
  unarchive: ArchiveRestore,
  library: Library,
  lightbulb: Lightbulb,
  link: Link,
  lock: Lock,
  lore: NotebookPen,
  map: Map,
  maximize: Maximize,
  menu: Menu,
  message: MessageCircle,
  mic: Mic,
  minus: Minus,
  monster: Skull,
  move: Move,
  next: ChevronRight,
  pause: Pause,
  pin: MapPin,
  play: Play,
  plus: Plus,
  prev: ChevronLeft,
  prep: ClipboardList,
  pushpin: Pin,
  quest: Swords,
  rows: Rows3,
  scroll: ScrollText,
  search: Search,
  send: Send,
  shield: Shield,
  'shield-check': ShieldCheck,
  speech: Speech,
  spell: Sparkles,
  star: Star,
  stop: Square,
  sync: RefreshCw,
  target: Target,
  threads: ListTodo,
  tools: Wrench,
  trash: Trash2,
  trend: TrendingUp,
  user: User,
  undo: Undo2,
  upload: Upload,
  users: Users,
  'wifi-off': WifiOff,
  zap: Zap,
  zoom: ZoomIn,
}

function Icon({ name, size = '1.15em', className = '' }) {
  const Glyph = ICONS[name]
  if (!Glyph) return null
  return (
    <Glyph
      className={`icon${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      strokeWidth={1.5}
      absoluteStrokeWidth={false}
      aria-hidden="true"
      focusable="false"
    />
  )
}

export default Icon
