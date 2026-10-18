// Generated from supabase/schema.sql — do not edit by hand.
// Regenerate after a schema change: `npm run db:types` (see README).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      campaign_art: {
        Row: {
          id: string
          campaign_id: string
          image_path: string
          title: string
          category: string
          notes: string
          shared: boolean
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          image_path: string
          title?: string
          category?: string
          notes?: string
          shared?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          image_path?: string
          title?: string
          category?: string
          notes?: string
          shared?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_art_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_members: {
        Row: {
          id: string
          campaign_id: string
          player_id: string
          role: string
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          player_id: string
          role?: string
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          player_id?: string
          role?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          id: string
          name: string
          description: string
          cover_image_path: string | null
          archived: boolean
          created_at: string
          join_code: string | null
          created_by: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string
          cover_image_path?: string | null
          archived?: boolean
          created_at?: string
          join_code?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string
          cover_image_path?: string | null
          archived?: boolean
          created_at?: string
          join_code?: string | null
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      character_sheets: {
        Row: {
          id: string
          campaign_id: string
          party_member_id: string
          mechanics: Json
          narrative: Json
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          party_member_id: string
          mechanics?: Json
          narrative?: Json
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          party_member_id?: string
          mechanics?: Json
          narrative?: Json
          updated_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_sheets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_sheets_party_member_id_fkey"
            columns: ["party_member_id"]
            isOneToOne: false
            referencedRelation: "party_members"
            referencedColumns: ["id"]
          },
        ]
      }
      creatures: {
        Row: {
          id: string
          campaign_id: string
          name: string
          kind: string
          creature_type: string
          challenge: string
          armor_class: number | null
          hit_points: number | null
          encountered_at: string
          notes: string
          created_at: string
          dm_creature_id: string | null
          photos: Json
        }
        Insert: {
          id?: string
          campaign_id: string
          name: string
          kind?: string
          creature_type?: string
          challenge?: string
          armor_class?: number | null
          hit_points?: number | null
          encountered_at?: string
          notes?: string
          created_at?: string
          dm_creature_id?: string | null
          photos?: Json
        }
        Update: {
          id?: string
          campaign_id?: string
          name?: string
          kind?: string
          creature_type?: string
          challenge?: string
          armor_class?: number | null
          hit_points?: number | null
          encountered_at?: string
          notes?: string
          created_at?: string
          dm_creature_id?: string | null
          photos?: Json
        }
        Relationships: [
          {
            foreignKeyName: "creatures_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creatures_dm_creature_id_fkey"
            columns: ["dm_creature_id"]
            isOneToOne: false
            referencedRelation: "dm_creatures"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_tab_entries: {
        Row: {
          id: string
          custom_tab_id: string
          title: string
          notes: string
          created_at: string
        }
        Insert: {
          id?: string
          custom_tab_id: string
          title: string
          notes?: string
          created_at?: string
        }
        Update: {
          id?: string
          custom_tab_id?: string
          title?: string
          notes?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_tab_entries_custom_tab_id_fkey"
            columns: ["custom_tab_id"]
            isOneToOne: false
            referencedRelation: "custom_tabs"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_tabs: {
        Row: {
          id: string
          campaign_id: string
          name: string
          created_at: string
          created_by: string | null
          is_private: boolean
        }
        Insert: {
          id?: string
          campaign_id: string
          name: string
          created_at?: string
          created_by?: string | null
          is_private?: boolean
        }
        Update: {
          id?: string
          campaign_id?: string
          name?: string
          created_at?: string
          created_by?: string | null
          is_private?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "custom_tabs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_tabs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_creatures: {
        Row: {
          id: string
          campaign_id: string
          name: string
          kind: string
          creature_type: string
          challenge: string
          armor_class: number | null
          hit_points: number | null
          description: string
          secrets: string
          share_stats: boolean
          created_at: string
          photos: Json
        }
        Insert: {
          id?: string
          campaign_id: string
          name: string
          kind?: string
          creature_type?: string
          challenge?: string
          armor_class?: number | null
          hit_points?: number | null
          description?: string
          secrets?: string
          share_stats?: boolean
          created_at?: string
          photos?: Json
        }
        Update: {
          id?: string
          campaign_id?: string
          name?: string
          kind?: string
          creature_type?: string
          challenge?: string
          armor_class?: number | null
          hit_points?: number | null
          description?: string
          secrets?: string
          share_stats?: boolean
          created_at?: string
          photos?: Json
        }
        Relationships: [
          {
            foreignKeyName: "dm_creatures_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_maps: {
        Row: {
          id: string
          campaign_id: string
          image_path: string
          caption: string
          notes: string
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          image_path: string
          caption?: string
          notes?: string
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          image_path?: string
          caption?: string
          notes?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_maps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_npcs: {
        Row: {
          id: string
          campaign_id: string
          name: string
          race: string
          occupation: string
          location: string
          description: string
          secrets: string
          photo_path: string | null
          revealed_npc_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          name: string
          race?: string
          occupation?: string
          location?: string
          description?: string
          secrets?: string
          photo_path?: string | null
          revealed_npc_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          name?: string
          race?: string
          occupation?: string
          location?: string
          description?: string
          secrets?: string
          photo_path?: string | null
          revealed_npc_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_npcs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_npcs_revealed_npc_id_fkey"
            columns: ["revealed_npc_id"]
            isOneToOne: false
            referencedRelation: "npcs"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_share_dismissals: {
        Row: {
          id: string
          share_id: string
          player_id: string
          created_at: string
        }
        Insert: {
          id?: string
          share_id: string
          player_id: string
          created_at?: string
        }
        Update: {
          id?: string
          share_id?: string
          player_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_share_dismissals_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_share_dismissals_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "dm_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_shares: {
        Row: {
          id: string
          campaign_id: string
          kind: string
          source_id: string
          title: string
          payload: Json
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          kind: string
          source_id: string
          title?: string
          payload?: Json
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          kind?: string
          source_id?: string
          title?: string
          payload?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_shares_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      encounters: {
        Row: {
          id: string
          campaign_id: string
          state: Json
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          state?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          state?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "encounters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_links: {
        Row: {
          id: string
          campaign_id: string
          source_type: string
          source_id: string
          target_type: string
          target_id: string
          relation: string
          notes: string
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          source_type: string
          source_id: string
          target_type: string
          target_id: string
          relation?: string
          notes?: string
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          source_type?: string
          source_id?: string
          target_type?: string
          target_id?: string
          relation?: string
          notes?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_links_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          id: string
          kind: string
          message: string
          created_at: string
          player_id: string | null
          status: string
          solved_at: string | null
        }
        Insert: {
          id?: string
          kind?: string
          message: string
          created_at?: string
          player_id?: string | null
          status?: string
          solved_at?: string | null
        }
        Update: {
          id?: string
          kind?: string
          message?: string
          created_at?: string
          player_id?: string | null
          status?: string
          solved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      loot: {
        Row: {
          id: string
          campaign_id: string
          item: string
          found_at: string
          holder: string
          notes: string
          created_at: string
          usable: boolean
          used: boolean
          kind: string
          photo_path: string | null
          quantity: number | null
        }
        Insert: {
          id?: string
          campaign_id: string
          item: string
          found_at?: string
          holder?: string
          notes?: string
          created_at?: string
          usable?: boolean
          used?: boolean
          kind?: string
          photo_path?: string | null
          quantity?: number | null
        }
        Update: {
          id?: string
          campaign_id?: string
          item?: string
          found_at?: string
          holder?: string
          notes?: string
          created_at?: string
          usable?: boolean
          used?: boolean
          kind?: string
          photo_path?: string | null
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loot_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      lore_entries: {
        Row: {
          id: string
          campaign_id: string
          title: string
          category: string
          notes: string
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          title: string
          category?: string
          notes?: string
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          title?: string
          category?: string
          notes?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lore_entries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      map_markers: {
        Row: {
          id: string
          map_id: string
          x: number
          y: number
          title: string
          notes: string
          photo_path: string | null
          created_at: string
          kind: string
          category: string
          entity_type: string | null
          entity_id: string | null
          sort_order: number | null
        }
        Insert: {
          id?: string
          map_id: string
          x: number
          y: number
          title?: string
          notes?: string
          photo_path?: string | null
          created_at?: string
          kind?: string
          category?: string
          entity_type?: string | null
          entity_id?: string | null
          sort_order?: number | null
        }
        Update: {
          id?: string
          map_id?: string
          x?: number
          y?: number
          title?: string
          notes?: string
          photo_path?: string | null
          created_at?: string
          kind?: string
          category?: string
          entity_type?: string | null
          entity_id?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "map_markers_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
        ]
      }
      map_pin_moves: {
        Row: {
          id: string
          map_id: string
          x: number
          y: number
          created_at: string
        }
        Insert: {
          id?: string
          map_id: string
          x: number
          y: number
          created_at?: string
        }
        Update: {
          id?: string
          map_id?: string
          x?: number
          y?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "map_pin_moves_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
        ]
      }
      maps: {
        Row: {
          id: string
          campaign_id: string
          image_path: string
          caption: string
          created_at: string
          is_world_map: boolean
          pin_x: number | null
          pin_y: number | null
          source_marker_id: string | null
          dm_map_id: string | null
        }
        Insert: {
          id?: string
          campaign_id: string
          image_path: string
          caption?: string
          created_at?: string
          is_world_map?: boolean
          pin_x?: number | null
          pin_y?: number | null
          source_marker_id?: string | null
          dm_map_id?: string | null
        }
        Update: {
          id?: string
          campaign_id?: string
          image_path?: string
          caption?: string
          created_at?: string
          is_world_map?: boolean
          pin_x?: number | null
          pin_y?: number | null
          source_marker_id?: string | null
          dm_map_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maps_dm_map_id_fkey"
            columns: ["dm_map_id"]
            isOneToOne: false
            referencedRelation: "dm_maps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maps_source_marker_id_fkey"
            columns: ["source_marker_id"]
            isOneToOne: false
            referencedRelation: "map_markers"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          player_id: string
          kind: string
          title: string
          body: string
          created_at: string
          read_at: string | null
        }
        Insert: {
          id?: string
          player_id: string
          kind?: string
          title: string
          body?: string
          created_at?: string
          read_at?: string | null
        }
        Update: {
          id?: string
          player_id?: string
          kind?: string
          title?: string
          body?: string
          created_at?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      npcs: {
        Row: {
          id: string
          campaign_id: string
          name: string
          race: string
          met_at: string
          status: string
          photo_path: string | null
          created_at: string
          description: string
          dm_npc_id: string | null
          attitude: string | null
          attitude_log: Json
        }
        Insert: {
          id?: string
          campaign_id: string
          name: string
          race?: string
          met_at?: string
          status?: string
          photo_path?: string | null
          created_at?: string
          description?: string
          dm_npc_id?: string | null
          attitude?: string | null
          attitude_log?: Json
        }
        Update: {
          id?: string
          campaign_id?: string
          name?: string
          race?: string
          met_at?: string
          status?: string
          photo_path?: string | null
          created_at?: string
          description?: string
          dm_npc_id?: string | null
          attitude?: string | null
          attitude_log?: Json
        }
        Relationships: [
          {
            foreignKeyName: "npcs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "npcs_dm_npc_id_fkey"
            columns: ["dm_npc_id"]
            isOneToOne: false
            referencedRelation: "dm_npcs"
            referencedColumns: ["id"]
          },
        ]
      }
      party_goals: {
        Row: {
          id: string
          campaign_id: string
          title: string
          status: string
          notes: string
          created_at: string
          steps: Json
          completed_at: string | null
        }
        Insert: {
          id?: string
          campaign_id: string
          title: string
          status?: string
          notes?: string
          created_at?: string
          steps?: Json
          completed_at?: string | null
        }
        Update: {
          id?: string
          campaign_id?: string
          title?: string
          status?: string
          notes?: string
          created_at?: string
          steps?: Json
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "party_goals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      party_members: {
        Row: {
          id: string
          campaign_id: string
          name: string
          player_name: string
          member_type: string
          race_class: string
          level: number
          notes: string
          photo_path: string | null
          claimed_by: string | null
          created_at: string
          animal_companion: string
        }
        Insert: {
          id?: string
          campaign_id: string
          name: string
          player_name?: string
          member_type?: string
          race_class?: string
          level?: number
          notes?: string
          photo_path?: string | null
          claimed_by?: string | null
          created_at?: string
          animal_companion?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          name?: string
          player_name?: string
          member_type?: string
          race_class?: string
          level?: number
          notes?: string
          photo_path?: string | null
          claimed_by?: string | null
          created_at?: string
          animal_companion?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_members_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      party_notes: {
        Row: {
          id: string
          party_member_id: string
          author_player_id: string
          notes: string
          created_at: string
        }
        Insert: {
          id?: string
          party_member_id: string
          author_player_id: string
          notes?: string
          created_at?: string
        }
        Update: {
          id?: string
          party_member_id?: string
          author_player_id?: string
          notes?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_notes_author_player_id_fkey"
            columns: ["author_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_notes_party_member_id_fkey"
            columns: ["party_member_id"]
            isOneToOne: false
            referencedRelation: "party_members"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_requests: {
        Row: {
          id: string
          player_id: string
          created_at: string
          handled_at: string | null
        }
        Insert: {
          id?: string
          player_id: string
          created_at?: string
          handled_at?: string | null
        }
        Update: {
          id?: string
          player_id?: string
          created_at?: string
          handled_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "password_reset_requests_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      password_resets: {
        Row: {
          id: string
          player_id: string
          token: string
          created_at: string
          expires_at: string
          used_at: string | null
        }
        Insert: {
          id?: string
          player_id: string
          token: string
          created_at?: string
          expires_at?: string
          used_at?: string | null
        }
        Update: {
          id?: string
          player_id?: string
          token?: string
          created_at?: string
          expires_at?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "password_resets_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_goals: {
        Row: {
          id: string
          campaign_id: string
          player_id: string
          title: string
          status: string
          notes: string
          steps: Json
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          player_id: string
          title: string
          status?: string
          notes?: string
          steps?: Json
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          player_id?: string
          title?: string
          status?: string
          notes?: string
          steps?: Json
          completed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_goals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_goals_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          id: string
          campaign_id: string
          name: string
          kind: string
          notes: string
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          name: string
          kind?: string
          notes?: string
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          name?: string
          kind?: string
          notes?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "places_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      player_invites: {
        Row: {
          id: string
          token: string
          campaign_id: string | null
          note: string
          created_at: string
          expires_at: string
          used_at: string | null
          used_by: string | null
          revoked_at: string | null
          created_by: string | null
        }
        Insert: {
          id?: string
          token: string
          campaign_id?: string | null
          note?: string
          created_at?: string
          expires_at?: string
          used_at?: string | null
          used_by?: string | null
          revoked_at?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string
          token?: string
          campaign_id?: string | null
          note?: string
          created_at?: string
          expires_at?: string
          used_at?: string | null
          used_by?: string | null
          revoked_at?: string | null
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_invites_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_invites_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_profiles: {
        Row: {
          player_id: string
          avatar_path: string | null
          updated_at: string
        }
        Insert: {
          player_id: string
          avatar_path?: string | null
          updated_at?: string
        }
        Update: {
          player_id?: string
          avatar_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_profiles_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_shards: {
        Row: {
          id: string
          campaign_id: string
          player_id: string
          shards: number
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          player_id: string
          shards?: number
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          player_id?: string
          shards?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_shards_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_shards_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_wallets: {
        Row: {
          id: string
          campaign_id: string
          player_id: string
          platinum: number
          gold: number
          silver: number
          shilling: number
          copper: number
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          player_id: string
          platinum?: number
          gold?: number
          silver?: number
          shilling?: number
          copper?: number
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          player_id?: string
          platinum?: number
          gold?: number
          silver?: number
          shilling?: number
          copper?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_wallets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_wallets_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          id: string
          username: string
          password_hash: string
          created_at: string
          display_name: string
          email: string | null
        }
        Insert: {
          id?: string
          username: string
          password_hash: string
          created_at?: string
          display_name?: string
          email?: string | null
        }
        Update: {
          id?: string
          username?: string
          password_hash?: string
          created_at?: string
          display_name?: string
          email?: string | null
        }
        Relationships: []
      }
      poll_votes: {
        Row: {
          id: string
          poll_id: string
          campaign_id: string
          player_id: string
          voter_name: string
          option_index: number
          created_at: string
        }
        Insert: {
          id?: string
          poll_id: string
          campaign_id: string
          player_id: string
          voter_name?: string
          option_index: number
          created_at?: string
        }
        Update: {
          id?: string
          poll_id?: string
          campaign_id?: string
          player_id?: string
          voter_name?: string
          option_index?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          id: string
          campaign_id: string
          question: string
          options: Json
          created_by: string | null
          created_by_name: string
          status: string
          result: string
          closed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          question: string
          options?: Json
          created_by?: string | null
          created_by_name?: string
          status?: string
          result?: string
          closed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          question?: string
          options?: Json
          created_by?: string | null
          created_by_name?: string
          status?: string
          result?: string
          closed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      quests: {
        Row: {
          id: string
          campaign_id: string
          name: string
          status: string
          given_by: string
          notes: string
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          name: string
          status?: string
          given_by?: string
          notes?: string
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          name?: string
          status?: string
          given_by?: string
          notes?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quests_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_notes: {
        Row: {
          id: string
          campaign_id: string
          player_id: string
          content: string
          session_note_id: string | null
          converted_to: string
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          player_id: string
          content: string
          session_note_id?: string | null
          converted_to?: string
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          player_id?: string
          content?: string
          session_note_id?: string | null
          converted_to?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_notes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_notes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_notes_session_note_id_fkey"
            columns: ["session_note_id"]
            isOneToOne: false
            referencedRelation: "session_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      session_notes: {
        Row: {
          id: string
          campaign_id: string
          player_id: string | null
          title: string
          session_date: string
          notes: string
          created_at: string
          audio_path: string | null
          audio_seconds: number | null
          audio_marks: Json
        }
        Insert: {
          id?: string
          campaign_id: string
          player_id?: string | null
          title?: string
          session_date?: string
          notes?: string
          created_at?: string
          audio_path?: string | null
          audio_seconds?: number | null
          audio_marks?: Json
        }
        Update: {
          id?: string
          campaign_id?: string
          player_id?: string | null
          title?: string
          session_date?: string
          notes?: string
          created_at?: string
          audio_path?: string | null
          audio_seconds?: number | null
          audio_marks?: Json
        }
        Relationships: [
          {
            foreignKeyName: "session_notes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      session_prep: {
        Row: {
          id: string
          campaign_id: string
          player_id: string
          data: Json
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          player_id: string
          data?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          player_id?: string
          data?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_prep_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_prep_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      spells: {
        Row: {
          id: string
          campaign_id: string
          player_id: string | null
          name: string
          level: number
          details: string
          created_at: string
          casting_time: string
          range: string
          components: string
          duration: string
          effect: string
          flavor: string
        }
        Insert: {
          id?: string
          campaign_id: string
          player_id?: string | null
          name: string
          level?: number
          details?: string
          created_at?: string
          casting_time?: string
          range?: string
          components?: string
          duration?: string
          effect?: string
          flavor?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          player_id?: string | null
          name?: string
          level?: number
          details?: string
          created_at?: string
          casting_time?: string
          range?: string
          components?: string
          duration?: string
          effect?: string
          flavor?: string
        }
        Relationships: [
          {
            foreignKeyName: "spells_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spells_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      campaign_memberships: {
        Row: {
          player_id: string | null
          role: string | null
          id: string | null
          name: string | null
          description: string | null
          cover_image_path: string | null
          archived: boolean | null
          created_at: string | null
          join_code: string | null
          created_by: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_player_invite: {
        Args: {
          p_player_id: string
          p_token: string
        }
        Returns: {
          campaign_id: string
          campaign_name: string
        }[]
      }
      check_password_reset: {
        Args: {
          p_token: string
        }
        Returns: {
          status: string
          username: string
        }[]
      }
      check_player_invite: {
        Args: {
          p_token: string
        }
        Returns: {
          status: string
          campaign_name: string
        }[]
      }
      complete_password_reset: {
        Args: {
          p_token: string
          p_new_password: string
        }
        Returns: string
      }
      create_campaign: {
        Args: {
          p_player_id: string
          p_name: string
          p_description?: string
          p_cover_image_path?: string
        }
        Returns: {
          id: string
          join_code: string
        }[]
      }
      create_campaign_invite: {
        Args: {
          p_player_id: string
          p_campaign_id: string
          p_note?: string
        }
        Returns: {
          id: string
          token: string
        }[]
      }
      create_password_reset: {
        Args: {
          p_admin_password: string
          p_player_id: string
        }
        Returns: string
      }
      create_player: {
        Args: {
          p_username: string
          p_password: string
          p_admin_password: string
        }
        Returns: string
      }
      create_player_invite: {
        Args: {
          p_admin_password: string
          p_campaign_id: string
          p_note?: string
        }
        Returns: {
          id: string
          token: string
        }[]
      }
      delete_player: {
        Args: {
          p_player_id: string
          p_admin_password: string
        }
        Returns: undefined
      }
      dismiss_password_reset_request: {
        Args: {
          p_admin_password: string
          p_request_id: string
        }
        Returns: undefined
      }
      get_my_account: {
        Args: {
          p_player_id: string
        }
        Returns: {
          username: string
          display_name: string
          email_hint: string
        }[]
      }
      is_campaign_dm: {
        Args: {
          p_player_id: string
          p_campaign_id: string
        }
        Returns: boolean
      }
      join_campaign: {
        Args: {
          p_player_id: string
          p_join_code: string
        }
        Returns: string
      }
      list_campaign_invites: {
        Args: {
          p_player_id: string
          p_campaign_id: string
        }
        Returns: {
          id: string
          token: string
          campaign_id: string
          campaign_name: string
          note: string
          created_at: string
          expires_at: string
          used_at: string
          used_by_username: string
          revoked_at: string
        }[]
      }
      list_campaign_members: {
        Args: {
          p_campaign_id: string
        }
        Returns: {
          membership_id: string
          player_id: string
          username: string
          role: string
        }[]
      }
      list_campaign_players: {
        Args: {
          p_campaign_id: string
        }
        Returns: {
          player_id: string
          username: string
          display_name: string
          role: string
          joined_at: string
        }[]
      }
      list_password_reset_requests: {
        Args: {
          p_admin_password: string
        }
        Returns: {
          id: string
          player_id: string
          username: string
          display_name: string
          email: string
          created_at: string
        }[]
      }
      list_player_invites: {
        Args: {
          p_admin_password: string
        }
        Returns: {
          id: string
          token: string
          campaign_id: string
          campaign_name: string
          note: string
          created_at: string
          expires_at: string
          used_at: string
          used_by_username: string
          revoked_at: string
        }[]
      }
      list_players: {
        Args: {
          p_admin_password: string
        }
        Returns: {
          id: string
          username: string
          display_name: string
          email: string
          created_at: string
        }[]
      }
      register_player: {
        Args: {
          p_invite_token: string
          p_username: string
          p_display_name: string
          p_password: string
          p_email: string
        }
        Returns: string
      }
      request_password_reset: {
        Args: {
          p_identifier: string
        }
        Returns: undefined
      }
      revoke_campaign_invite: {
        Args: {
          p_player_id: string
          p_invite_id: string
        }
        Returns: undefined
      }
      revoke_player_invite: {
        Args: {
          p_admin_password: string
          p_invite_id: string
        }
        Returns: undefined
      }
      update_my_account: {
        Args: {
          p_player_id: string
          p_current_password: string
          p_username?: string
          p_display_name?: string
          p_email?: string
          p_new_password?: string
        }
        Returns: undefined
      }
      update_player: {
        Args: {
          p_player_id: string
          p_username: string
          p_password: string
          p_admin_password: string
        }
        Returns: undefined
      }
      verify_admin_password: {
        Args: {
          p_admin_password: string
        }
        Returns: boolean
      }
      verify_login: {
        Args: {
          p_username: string
          p_password: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

// Shorthands: Tables<"npcs"> is a row, TablesInsert<"npcs"> an insert payload.
export type Tables<T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> = (PublicSchema["Tables"] & PublicSchema["Views"])[T] extends { Row: infer R } ? R : never
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
