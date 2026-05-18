# 3D Bridge - Addon (Skrypt Python) dla Unreal Engine

Ten folder zawiera narzędzia służące do bezproblemowej integracji z Unreal Engine, w tym skrypt automatyzujący proces budowania instancji materiałów po ich wyeksportowaniu z aplikacji Bridge.

## 1. Jak to działa?

Zgodnie z systemem, aplikacja zrzuca pliki folderu (`.jpg` / `.exr` i `.json`) wprost do wybranego projektu Unreal Engine w ścieżce: `/Content/3dbridge/[Typ]/[Nazwa]`. Unreal Engine automatycznie załaduje te pliki i zmieni je na `Texture2D` i `uasset`.

Aby zautomatyzować budowę i podpięcie tekstur pod instancję materiału (`Material Instance`), wystarczy wywołać skrypt w Unreal Engine:

1. Włącz obsługę skryptów Python w Unreal Engine (włączając wtyczki `Python Editor Script Plugin` i `Editor Scripting Utilities`).
2. Przygotuj **Master Material**.

## 2. Tworzenie Master Material w Unreal (zgodnie z załączonym Blueprint)

Przed pierwszym wykonaniem skryptu musisz przygotować materiał bazowy o nazwie `M_Bridge_Default`. Skrypt szuka go w strukturze Twojego silnika po ścieżce:
`/Game/3dbridge/Materials/M_Bridge_Default` (tj. leży w `Content/3dbridge/Materials/`)

Zgodnie z przekazaną mapą Node'ów wykonaj w edytorze materiałów następującą strukturę z parametrami:
- **Albedo** (TextureSampleParameter2D, domyślnie kolor RGB do `Base Color`).
- **Normal** (TextureSampleParameter2D z typem sRGB False do `Normal`).
- **ORD** (TextureSampleParameter2D dla kanałów pakowanych):
  - z wyjścia **G** (Green) połącz się prosto z **Roughness**.
  - z wyjścia **R** (Red) zrób węzeł **Multiply**, do jego wejścia **B** podepnij parametr skalarny (ScalarParameter) nazwany `AO` (ustaw mu domyślnie wartość np. 1.0) i wyjście Multiply połącz do **Ambient Occlusion**.

## 3. Uruchamianie skryptu `3dBridgeImporter.py`

### Opcja A: Z poziomu skonsolowanej linii logów z Pythonem
1. Odpal okno konsoli u dołu Unreala (Zmień na "Cmd" -> "Python").
2. Wpisz komendę ładującą nasz plik (zakładając, że wrzuciłeś skrypt do folderu pobranego z repozytorium/aplikacji, zmień ścieżkę):
   ```python
   exec(open('X:/KatalogZTwojaAplikacja/unreal_addon/3dBridgeImporter.py').read())
   ```

### Opcja B: Edytor Utility Blueprint / Przycisk na pulpicie
Możesz uczynić to wywołanie interaktywne po prostu dodając wtyczkę narzędziową Editor Utility z przyciskiem "Setup Bridge Assets" wykonującym po prostu `Execute Python Script` -> dając ścieżkę do skryptu lub samą treść skryptu.

---

**Ciekawostki ze skryptu:**
- Pliki `.json` powiązane z danym zasobem, po przeprocesowaniu automatycznie dostają w nazwie zwrotkę `.imported`, by skrypt za następnym odpaleniem nie obrabiał tych samych materiałów i nie nadpisywał pracy grafików.
- Moduł od razu sprawdza mapę O.R.D - czy nie ma kompresji `sRGB` podczas ustawiania w edytorze i zdejmuje ten status zabezpieczając kolory parametrów pbr.
