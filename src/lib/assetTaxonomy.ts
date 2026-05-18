/**
 * Asset Taxonomy — Bridge Library
 *
 * Hierarchia:
 *   Group → Subcategories → (opcjonalnie tagi)
 *
 * Używane przez:
 *   - sidebar filter
 *   - NewAssetModal (type selector)
 *   - scan/metadata matching
 */

export interface AssetSubcategory {
    id: string;
    label: string;
    tags?: string[];         // słowa kluczowe do auto-match przy skanowaniu
}

export interface AssetGroup {
    id: string;
    label: string;
    types: string[];         // wartości pola asset.type w JSON
    addType: string;         // typ przekazywany do NewAssetModal
    color: string;           // accent color (klasa Tailwind)
    subcategories: AssetSubcategory[];
}

export const ASSET_TAXONOMY: AssetGroup[] = [

    // ─────────────────────────────────────────────────────────────
    // MATERIALS / SURFACES
    // ─────────────────────────────────────────────────────────────
    {
        id: 'MATERIALS',
        label: 'Materials',
        types: ['surface'],
        addType: 'surface',
        color: 'text-sky-400',
        subcategories: [
            // Budowlane / Architektura
            { id: 'concrete', label: 'Concrete', tags: ['concrete', 'cement', 'beton'] },
            { id: 'brick', label: 'Brick & Masonry', tags: ['brick', 'masonry', 'cegła', 'wall'] },
            { id: 'plaster', label: 'Plaster & Stucco', tags: ['plaster', 'stucco', 'tynk'] },
            { id: 'tiles', label: 'Tiles & Ceramics', tags: ['tile', 'ceramic', 'kafel', 'floor', 'mozaika'] },
            { id: 'asphalt', label: 'Asphalt & Road', tags: ['asphalt', 'road', 'pavement', 'droga'] },

            // Kamień / Skały
            { id: 'rock', label: 'Rock & Stone', tags: ['rock', 'stone', 'kamień', 'cliff', 'boulder'] },
            { id: 'marble', label: 'Marble & Granite', tags: ['marble', 'granite', 'marmur'] },
            { id: 'gravel', label: 'Gravel & Pebble', tags: ['gravel', 'pebble', 'żwir', 'cobblestone'] },

            // Drewno
            { id: 'wood_planks', label: 'Wood Planks & Boards', tags: ['wood', 'plank', 'drewno', 'board', 'lumber'] },
            { id: 'wood_bark', label: 'Wood Bark & Log', tags: ['bark', 'log', 'kora', 'timber'] },

            // Metal
            { id: 'metal_raw', label: 'Metal Raw', tags: ['metal', 'steel', 'iron', 'stal', 'żelazo'] },
            { id: 'metal_painted', label: 'Metal Painted', tags: ['painted metal', 'enamel', 'lakier'] },
            { id: 'metal_worn', label: 'Metal Worn & Rust', tags: ['rust', 'rusted', 'worn', 'rdza', 'korozja'] },
            { id: 'metal_grate', label: 'Metal Grate & Mesh', tags: ['grate', 'mesh', 'grid', 'kratka'] },

            // Organiczne
            { id: 'soil', label: 'Soil & Dirt', tags: ['soil', 'dirt', 'ziemia', 'mud', 'błoto'] },
            { id: 'sand', label: 'Sand & Desert', tags: ['sand', 'desert', 'piasek', 'dune'] },
            { id: 'grass', label: 'Grass & Moss', tags: ['grass', 'moss', 'trawa', 'mech', 'lawn'] },
            { id: 'snow', label: 'Snow & Ice', tags: ['snow', 'ice', 'śnieg', 'lód', 'frost'] },
            { id: 'water_surface', label: 'Water Surface', tags: ['water', 'ocean', 'lake', 'woda', 'pool'] },
            { id: 'leaves', label: 'Leaves & Foliage', tags: ['leaf', 'leaves', 'liść', 'foliage'] },

            // Tkaniny
            { id: 'fabric', label: 'Fabric & Cloth', tags: ['fabric', 'cloth', 'tkanina', 'textile', 'carpet'] },
            { id: 'leather', label: 'Leather & Skin', tags: ['leather', 'skin', 'skóra', 'hide'] },

            // Syntetyczne
            { id: 'plastic', label: 'Plastic & Rubber', tags: ['plastic', 'rubber', 'plastik', 'guma', 'polymer'] },
            { id: 'glass', label: 'Glass', tags: ['glass', 'szkło', 'transparent'] },
            { id: 'carbon', label: 'Carbon Fiber', tags: ['carbon', 'fiber', 'kevlar'] },

            // Specjalne efekty
            { id: 'emissive', label: 'Emissive & Glow', tags: ['emissive', 'glow', 'neon', 'led', 'świecący'] },
            { id: 'decal_mat', label: 'Decal Materials', tags: ['decal', 'sticker', 'graffiti', 'paint', 'spray'] },
        ]
    },

    // ─────────────────────────────────────────────────────────────
    // 3D MODELS
    // ─────────────────────────────────────────────────────────────
    {
        id: '3D MODELS',
        label: '3D Models',
        types: ['3d'],
        addType: '3d',
        color: 'text-violet-400',
        subcategories: [
            // Architektura
            { id: 'arch_exterior', label: 'Architecture Exterior', tags: ['building', 'facade', 'house', 'exterior', 'budynek'] },
            { id: 'arch_interior', label: 'Architecture Interior', tags: ['interior', 'room', 'ceiling', 'wall_arch'] },
            { id: 'arch_modular', label: 'Modular Kit', tags: ['modular', 'kit', 'tile_3d', 'set'] },
            { id: 'arch_ruins', label: 'Ruins & Debris', tags: ['ruins', 'debris', 'rubble', 'gruz', 'broken'] },

            // Przyroda
            { id: 'rocks_geo', label: 'Rocks & Boulders', tags: ['rock', 'boulder', 'stone_3d', 'cliff_3d'] },
            { id: 'terrain', label: 'Terrain & Landscape', tags: ['terrain', 'landscape', 'ground', 'hill', 'teren'] },

            // Infrastruktura / Urban
            { id: 'urban_street', label: 'Urban Street Elements', tags: ['street', 'sign', 'lamp', 'bench', 'ulica', 'latarnia'] },
            { id: 'urban_industrial', label: 'Urban Industrial', tags: ['pipe', 'tank', 'vent', 'industrial', 'factory'] },
            { id: 'urban_construction', label: 'Construction', tags: ['crane', 'scaffold', 'construction', 'budowa'] },

            // Meble / Wnętrza
            { id: 'furniture', label: 'Furniture', tags: ['furniture', 'chair', 'table', 'shelf', 'meble'] },
            { id: 'electronics', label: 'Electronics & Tech', tags: ['computer', 'phone', 'tv', 'screen', 'elektronika'] },
            { id: 'kitchenware', label: 'Kitchenware', tags: ['kitchen', 'plate', 'cup', 'bottle', 'kuchnia'] },

            // Militarny / Sci-Fi
            { id: 'weapons', label: 'Weapons & Military', tags: ['gun', 'rifle', 'sword', 'weapon', 'bron'] },
            { id: 'scifi', label: 'Sci-Fi & Futuristic', tags: ['sci-fi', 'futuristic', 'alien', 'cyber', 'robot'] },
            { id: 'containers', label: 'Containers & Crates', tags: ['crate', 'box', 'barrel', 'container', 'storage'] },

            // Dekoracje
            { id: 'props_generic', label: 'Generic Props', tags: ['prop', 'object', 'misc', 'asset'] },
            { id: 'food', label: 'Food & Consumables', tags: ['food', 'fruit', 'drink', 'jedzenie'] },
            { id: 'cloth_3d', label: 'Clothing & Accessories', tags: ['cloth', 'hat', 'bag', 'ubranie'] },
        ]
    },

    // ─────────────────────────────────────────────────────────────
    // 3D PLANTS / VEGETATION
    // ─────────────────────────────────────────────────────────────
    {
        id: '3D PLANTS',
        label: '3D Plants',
        types: ['3dplant'],
        addType: '3dplant',
        color: 'text-green-400',
        subcategories: [
            { id: 'trees', label: 'Trees Deciduous', tags: ['tree', 'oak', 'birch', 'maple', 'drzewo'] },
            { id: 'trees_conifer', label: 'Trees Coniferous', tags: ['pine', 'spruce', 'fir', 'conifer', 'świerk'] },
            { id: 'trees_tropical', label: 'Trees Tropical', tags: ['palm', 'tropical', 'jungle', 'palma'] },
            { id: 'trees_dead', label: 'Trees Dead & Winter', tags: ['dead tree', 'dry', 'winter tree'] },
            { id: 'bushes', label: 'Bushes & Shrubs', tags: ['bush', 'shrub', 'krzew'] },
            { id: 'grass_3d', label: 'Grass & Reeds', tags: ['grass', 'reed', 'fern', 'trawa_3d'] },
            { id: 'flowers', label: 'Flowers', tags: ['flower', 'rose', 'daisy', 'kwiat'] },
            { id: 'ground_cover', label: 'Ground Cover & Moss', tags: ['moss', 'lichen', 'clover', 'ivy', 'mech_3d'] },
            { id: 'aquatic', label: 'Aquatic Plants', tags: ['water lily', 'reed', 'aquatic', 'pond'] },
            { id: 'fungi', label: 'Fungi & Mushrooms', tags: ['mushroom', 'fungi', 'grzyb'] },
        ]
    },

    // ─────────────────────────────────────────────────────────────
    // VEHICLES
    // ─────────────────────────────────────────────────────────────
    {
        id: 'VEHICLES',
        label: 'Vehicles',
        types: ['vehicle'],
        addType: 'vehicle',
        color: 'text-amber-400',
        subcategories: [
            { id: 'car_civilian', label: 'Cars Civilian', tags: ['car', 'sedan', 'suv', 'hatchback', 'samochód'] },
            { id: 'car_sports', label: 'Cars Sports', tags: ['sports car', 'supercar', 'racing'] },
            { id: 'car_utility', label: 'Utility & Van', tags: ['van', 'truck', 'utility', 'delivery'] },
            { id: 'motorcycle', label: 'Motorcycles', tags: ['motorcycle', 'bike', 'motocykl'] },
            { id: 'aircraft', label: 'Aircraft', tags: ['plane', 'helicopter', 'aircraft', 'samolot'] },
            { id: 'watercraft', label: 'Watercraft', tags: ['boat', 'ship', 'submarine', 'łódź'] },
            { id: 'military_veh', label: 'Military', tags: ['tank', 'military vehicle', 'armored', 'czołg'] },
            { id: 'scifi_veh', label: 'Sci-Fi Vehicles', tags: ['spaceship', 'spacecraft', 'futuristic vehicle'] },
            { id: 'offroad', label: 'Off-Road & Heavy', tags: ['offroad', '4x4', 'truck heavy', 'construction vehicle'] },
        ]
    },

    // ─────────────────────────────────────────────────────────────
    // CHARACTERS
    // ─────────────────────────────────────────────────────────────
    {
        id: 'CHARACTERS',
        label: 'Characters',
        types: ['character'],
        addType: 'character',
        color: 'text-pink-400',
        subcategories: [
            { id: 'human_male', label: 'Human Male', tags: ['male', 'man', 'mężczyzna'] },
            { id: 'human_female', label: 'Human Female', tags: ['female', 'woman', 'kobieta'] },
            { id: 'human_child', label: 'Human Child', tags: ['child', 'kid', 'dziecko'] },
            { id: 'creature', label: 'Creatures & Monsters', tags: ['creature', 'monster', 'beast', 'potwór'] },
            { id: 'animal', label: 'Animals', tags: ['animal', 'dog', 'cat', 'horse', 'zwierzę'] },
            { id: 'robot', label: 'Robots & Androids', tags: ['robot', 'android', 'mech', 'cyborg'] },
            { id: 'fantasy', label: 'Fantasy Characters', tags: ['fantasy', 'elf', 'dwarf', 'orc', 'fantastyczny'] },
            { id: 'soldier', label: 'Military & Combat', tags: ['soldier', 'warrior', 'knight', 'żołnierz'] },
        ]
    },

    // ─────────────────────────────────────────────────────────────
    // SCENES
    // ─────────────────────────────────────────────────────────────
    {
        id: 'SCENES',
        label: 'Scenes',
        types: ['scene'],
        addType: 'scene',
        color: 'text-orange-400',
        subcategories: [
            { id: 'scene_nature', label: 'Nature & Outdoor', tags: ['nature', 'outdoor', 'forest', 'mountain', 'las'] },
            { id: 'scene_urban', label: 'Urban & City', tags: ['city', 'urban', 'street scene', 'alley', 'miasto'] },
            { id: 'scene_interior', label: 'Interior', tags: ['interior scene', 'room scene', 'studio'] },
            { id: 'scene_industrial', label: 'Industrial', tags: ['factory scene', 'warehouse', 'industrial'] },
            { id: 'scene_apocalyptic', label: 'Post-Apocalyptic', tags: ['ruins', 'apocalypse', 'destroyed', 'postapo'] },
            { id: 'scene_fantasy', label: 'Fantasy & Surreal', tags: ['fantasy scene', 'magical', 'surreal'] },
            { id: 'scene_scifi', label: 'Sci-Fi', tags: ['sci-fi scene', 'space', 'cyberpunk'] },
            { id: 'scene_hdri', label: 'HDRI Environments', tags: ['hdri', 'sky', 'environment', 'equirectangular'] },
        ]
    },

    // ─────────────────────────────────────────────────────────────
    // ADDONS / TOOLS
    // ─────────────────────────────────────────────────────────────
    {
        id: 'ADDONS',
        label: 'Add-ons & Tools',
        types: ['addon'],
        addType: 'addon',
        color: 'text-yellow-400',
        subcategories: [
            { id: 'addon_blender', label: 'Blender Add-ons', tags: ['blender', 'addon', 'plugin', 'script_bl'] },
            { id: 'addon_ue', label: 'Unreal Engine', tags: ['unreal', 'ue4', 'ue5', 'blueprint'] },
            { id: 'addon_unity', label: 'Unity', tags: ['unity', 'shader_u', 'prefab'] },
            { id: 'addon_substance', label: 'Substance / Adobe', tags: ['substance', 'sbs', 'sbsar', 'designer', 'painter'] },
            { id: 'addon_scripts', label: 'Scripts & Utilities', tags: ['script', 'python', 'tool', 'automation'] },
            { id: 'addon_presets', label: 'Presets & Settings', tags: ['preset', 'settings', 'config'] },
        ]
    },

    // ─────────────────────────────────────────────────────────────
    // PROJECT FILES (.blend, .fbx, .obj master files)
    // ─────────────────────────────────────────────────────────────
    {
        id: 'PROJECT FILES',
        label: 'Project Files',
        types: ['blend', 'fbx', 'obj_file'],
        addType: 'blend',
        color: 'text-orange-500',
        subcategories: [
            { id: 'blend_scene', label: 'Scenes (.blend)', tags: ['blend', 'scene', 'scena'] },
            { id: 'blend_model', label: 'Models (.blend)', tags: ['model', 'mesh', 'object'] },
            { id: 'blend_material', label: 'Material Libraries', tags: ['material', 'shader', 'materiał'] },
            { id: 'blend_animation', label: 'Animations', tags: ['animation', 'anim', 'action', 'animacja'] },
            { id: 'blend_rigged', label: 'Rigged Characters', tags: ['rig', 'rigged', 'armature', 'skeleton'] },
            { id: 'fbx_model', label: 'FBX Models', tags: ['fbx', 'autodesk'] },
            { id: 'fbx_anim', label: 'FBX Animations', tags: ['fbx', 'animation', 'motion'] },
            { id: 'obj_model', label: 'OBJ Models', tags: ['obj', 'wavefront'] },
        ]
    },

    // ─────────────────────────────────────────────────────────────
    // NEW CATEGORIES
    // ─────────────────────────────────────────────────────────────
    {
        id: 'HDRI',
        label: 'HDRi',
        types: ['hdri'],
        addType: 'hdri',
        color: 'text-amber-300',
        subcategories: [
            { id: 'hdri_outdoor', label: 'Outdoor', tags: ['outdoor', 'sky', 'sun'] },
            { id: 'hdri_indoor', label: 'Indoor', tags: ['indoor', 'studio', 'room'] },
            { id: 'hdri_night', label: 'Night & Dusk', tags: ['night', 'dusk', 'dark'] },
        ]
    },
    {
        id: 'BLUEPRINT',
        label: 'Blueprint',
        types: ['blueprint'],
        addType: 'blueprint',
        color: 'text-blue-500',
        subcategories: [
            { id: 'bp_logic', label: 'Logic & Gameplay', tags: ['logic', 'gameplay', 'manager'] },
            { id: 'bp_actor', label: 'Actors & Objects', tags: ['actor', 'object', 'spawner'] },
            { id: 'bp_ui', label: 'UI & Widgets', tags: ['ui', 'widget', 'hud'] },
        ]
    },
    {
        id: 'SOUND EFFECTS',
        label: 'Sound Effects',
        types: ['sfx'],
        addType: 'sfx',
        color: 'text-cyan-400',
        subcategories: [
            { id: 'sfx_ambient', label: 'Ambient', tags: ['ambient', 'nature', 'wind'] },
            { id: 'sfx_ui', label: 'UI Sounds', tags: ['click', 'hover', 'menu'] },
            { id: 'sfx_impact', label: 'Impacts', tags: ['hit', 'impact', 'crash'] },
        ]
    },
    {
        id: 'MUSIC',
        label: 'Music',
        types: ['music'],
        addType: 'music',
        color: 'text-rose-400',
        subcategories: [
            { id: 'music_orchestral', label: 'Orchestral', tags: ['orchestral', 'epic', 'cinematic'] },
            { id: 'music_electronic', label: 'Electronic', tags: ['electronic', 'techno', 'synth'] },
            { id: 'music_ambient', label: 'Ambient Music', tags: ['relax', 'ambient_m'] },
        ]
    },
    {
        id: 'VOICE',
        label: 'Voice',
        types: ['voice'],
        addType: 'voice',
        color: 'text-emerald-400',
        subcategories: [
            { id: 'voice_male', label: 'Male', tags: ['male_v'] },
            { id: 'voice_female', label: 'Female', tags: ['female_v'] },
            { id: 'voice_narration', label: 'Narration', tags: ['narrator', 'story'] },
        ]
    },
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Zwraca grupę po asset.type */
export function getGroupByType(assetType: string): AssetGroup | undefined {
    return ASSET_TAXONOMY.find(g => g.types.includes(assetType));
}

/** Zwraca wszystkie podkategorie spłaszczone (do dropdownów) */
export function getAllSubcategories(): AssetSubcategory[] {
    return ASSET_TAXONOMY.flatMap(g => g.subcategories);
}

/** Próbuje auto-dopasować subcategoryId na podstawie tagów i nazwy pliku */
export function detectSubcategory(filename: string, assetType: string): string | null {
    const group = getGroupByType(assetType);
    if (!group) return null;

    const lower = filename.toLowerCase();
    for (const sub of group.subcategories) {
        if (sub.tags?.some(tag => lower.includes(tag.toLowerCase()))) {
            return sub.id;
        }
    }
    return null;
}
