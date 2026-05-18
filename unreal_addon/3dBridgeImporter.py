import unreal
import os
import json

def log(msg):
    unreal.log(f"[3DBridge] {msg}")

def get_master_material():
    # Zmienna określająca ścieżkę do Master Material, który użytkownik musi stworzyć z dostarczonego Blueprinta
    master_mat_path = "/Game/3dbridge/Materials/M_Bridge_Default"
    master_mat = unreal.EditorAssetLibrary.load_asset(master_mat_path)
    
    if not master_mat:
        unreal.log_warning(f"[3DBridge] Nie znaleziono Master Material pod ścieżką: {master_mat_path}. Proszę go stworzyć podaną strukturą Blueprint!")
    return master_mat

def parse_json_metadata(json_path):
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        log(f"Błąd czytania {json_path}: {e}")
        return None

def find_textures(folder_path):
    textures = {}
    
    # Przeskanuj assety w folderze w Unrealu
    asset_paths = unreal.EditorAssetLibrary.list_assets(folder_path)
    for asset_path in asset_paths:
        asset_data = unreal.EditorAssetLibrary.find_asset_data(asset_path)
        if asset_data.asset_class_path.asset_name == "Texture2D":
            asset_name = asset_data.asset_name.lower()
            
            # Mapowanie po nazwach plików
            if "albedo" in asset_name or "color" in asset_name or "diffuse" in asset_name:
                textures["Albedo"] = asset_path
            elif "normal" in asset_name:
                textures["Normal"] = asset_path
                # Ustaw poprawną kompresję dla Normal Map
                tex = unreal.EditorAssetLibrary.load_asset(asset_path)
                if tex.compression_settings != unreal.TextureCompressionSettings.TC_NORMALMAP:
                    tex.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_NORMALMAP)
                    tex.set_editor_property("srgb", False)
            elif "ord" in asset_name or "orm" in asset_name:
                textures["ORD"] = asset_path
                # Ustaw RGB na linear dla map upakowanych
                tex = unreal.EditorAssetLibrary.load_asset(asset_path)
                if tex.srgb:
                    tex.set_editor_property("srgb", False)
            elif "roughness" in asset_name: # Jeśli tekstury są luźne
                textures["Roughness"] = asset_path
            elif "ao" in asset_name or "ambientocclusion" in asset_name:
                textures["AO"] = asset_path
            elif "displacement" in asset_name:
                textures["Displacement"] = asset_path
                
    return textures

def create_material_instance(folder_path, asset_name, textures, master_material):
    if not master_material:
        return
        
    mi_name = f"MI_{asset_name}"
    mi_path = f"{folder_path}/{mi_name}"
    
    # Sprawdź czy już istnieje
    if unreal.EditorAssetLibrary.does_asset_exist(mi_path):
        log(f"Material Instance {mi_name} już istnieje, aktualizowanie...")
        mi_asset = unreal.EditorAssetLibrary.load_asset(mi_path)
    else:
        # Stworzenie nowej instancji materiału
        asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
        factory = unreal.MaterialInstanceConstantFactoryNew()
        mi_asset = asset_tools.create_asset(mi_name, folder_path, unreal.MaterialInstanceConstant, factory)
    
    if mi_asset:
        unreal.MaterialEditingLibrary.set_material_instance_parent(mi_asset, master_material)
        
        # Podpinanie tekstur
        for param_name, tex_path in textures.items():
            tex_asset = unreal.EditorAssetLibrary.load_asset(tex_path)
            if tex_asset:
                if param_name in ["Albedo", "Normal", "ORD"]:
                    unreal.MaterialEditingLibrary.set_material_instance_texture_parameter_value(mi_asset, param_name, tex_asset)
                # Dla luźnych map, jeśli Master Material ma na nie piny, możemy je też podpiąć.
        
        unreal.MaterialEditingLibrary.update_material_instance(mi_asset)
        log(f"Stworzono/Zaktualizowano: {mi_name}")
        return True
    return False

def run_import_process():
    log("Rozpoczynanie skanowania 3DBridge w poszukiwaniu nowych assetów...")
    
    project_dir = unreal.Paths.project_dir()
    bridge_content_dir = os.path.join(project_dir, "Content", "3dbridge")
    
    if not os.path.exists(bridge_content_dir):
        log("Brak folderu 3dbridge w Content/. Upewnij się, że eksport z aplikacji się udał.")
        return
        
    master_mat = get_master_material()
    
    # Skanowanie przez Unreal API żeby pobrać wirtualne ścieżki /Game/3dbridge/...
    base_unreal_path = "/Game/3dbridge"
    
    # Przeszukuj foldery (np. /Game/3dbridge/Surface/Wood_123)
    # Z racji, że potrzebujemy też czytać JSONy z dysku, przejdźmy przez OS
    
    for root, dirs, files in os.walk(bridge_content_dir):
        for file in files:
            if file.endswith(".json"):
                json_path = os.path.join(root, file)
                
                # Zbuduj ścieżkę do wewnątrz Unreala
                rel_path = os.path.relpath(root, bridge_content_dir)
                rel_path = rel_path.replace("\\", "/") # Dla Windows
                unreal_folder_path = f"{base_unreal_path}/{rel_path}"
                
                metadata = parse_json_metadata(json_path)
                if metadata:
                    asset_name = metadata.get("name") or metadata.get("id") or os.path.basename(root)
                    
                    # Wyczyść nazwę dla Unreala
                    import re
                    asset_name = re.sub(r'[^a-zA-Z0-9_]', '_', asset_name)
                    
                    log(f"Przetwarzanie assetu: {asset_name} w {unreal_folder_path}")
                    
                    textures = find_textures(unreal_folder_path)
                    if textures:
                        create_material_instance(unreal_folder_path, asset_name, textures, master_mat)
                    
                    # Opcjonalnie: Zmiana rozszerzenia JSON na np. .imported żeby nie przetwarzać 2 razy
                    try:
                        os.rename(json_path, json_path + ".imported")
                    except Exception as e:
                        pass
                        
    log("Proces importowania zakończony.")

if __name__ == "__main__":
    run_import_process()
