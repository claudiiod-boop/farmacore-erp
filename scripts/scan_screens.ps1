param(
    [string]$TargetDir = "C:\Users\magno\OneDrive\Imagens\Screenshots\INOVA FARMA\02CADASTROS",
    [string]$OutputFile = "C:\Users\magno\.gemini\antigravity\scratch\farma-erp\cadastros_screens_ocr.xml"
)

[System.Reflection.Assembly]::LoadWithPartialName('System.Runtime.WindowsRuntime') | Out-Null
[Windows.Globalization.Language,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.StorageFile,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -match 'IAsyncOperation' })[0]

$files = Get-ChildItem -Path $TargetDir -Filter "*.png" | Sort-Object CreationTime

$results = @()

foreach ($f in $files) {
    try {
        $fileTask = [Windows.Storage.StorageFile]::GetFileFromPathAsync($f.FullName)
        $storageFile = $asTaskGeneric.MakeGenericMethod([Windows.Storage.StorageFile]).Invoke($null, @($fileTask)).Result
        
        $streamTask = $storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)
        $stream = $asTaskGeneric.MakeGenericMethod([Windows.Storage.Streams.IRandomAccessStream]).Invoke($null, @($streamTask)).Result
        
        $decoderTask = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
        $decoder = $asTaskGeneric.MakeGenericMethod([Windows.Graphics.Imaging.BitmapDecoder]).Invoke($null, @($decoderTask)).Result
        
        $bmpTask = $decoder.GetSoftwareBitmapAsync()
        $bmp = $asTaskGeneric.MakeGenericMethod([Windows.Graphics.Imaging.SoftwareBitmap]).Invoke($null, @($bmpTask)).Result
        
        $ocrTask = $engine.RecognizeAsync($bmp)
        $result = $asTaskGeneric.MakeGenericMethod([Windows.Media.Ocr.OcrResult]).Invoke($null, @($ocrTask)).Result
        
        $lines = $result.Lines | ForEach-Object { $_.Text }
        $topLines = $lines | Select-Object -First 5
        $header = ($topLines -join " | ")
        $allText = ($lines -join " `n ")
        
        $results += [PSCustomObject]@{
            File = $f.Name
            Header = $header
            AllText = $allText
        }
        Write-Host "$($f.Name) ===> $header"
    } catch {
        Write-Host "$($f.Name) ERROR: $_"
    }
}

$results | Export-Clixml -Path $OutputFile

