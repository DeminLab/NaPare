param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$ComposeProject,
  [string]$ComposeFile = "docker-compose.dev.yml",
  [string]$EnvFile = "apps/backend/.env"
)

$ErrorActionPreference = "Stop"

function Read-EnvValue([string]$Path, [string]$Name) {
  $line = Get-Content -LiteralPath $Path | Where-Object { $_ -match "^\s*$([regex]::Escape($Name))\s*=" } | Select-Object -Last 1
  if (-not $line) { throw "Missing $Name in backend environment file." }
  return ($line -replace "^\s*$([regex]::Escape($Name))\s*=", "").Trim().Trim('"').Trim("'")
}

function Quote-SqlIdentifier([string]$Value) { return '"' + $Value.Replace('"', '""') + '"' }
function Quote-SqlLiteral([string]$Value) { return "'" + $Value.Replace("'", "''") + "'" }
function Resolve-InputPath([string]$Path) {
  $candidate = if ([System.IO.Path]::IsPathRooted($Path)) { $Path } else { Join-Path $repoRoot $Path }
  return (Resolve-Path -LiteralPath $candidate -ErrorAction Stop).Path
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envPath = Resolve-InputPath $EnvFile
$composePath = Resolve-InputPath $ComposeFile
$nodeEnv = Read-EnvValue $envPath "NODE_ENV"
$dbHost = Read-EnvValue $envPath "DB_HOST"
$dbUser = Read-EnvValue $envPath "DB_USERNAME"
$dbPassword = Read-EnvValue $envPath "DB_PASSWORD"
$dbName = Read-EnvValue $envPath "DB_NAME"

if ($nodeEnv -ne "development") { throw "Refusing role provisioning unless NODE_ENV=development." }
if ($dbHost -notin @("localhost", "127.0.0.1")) { throw "Refusing role provisioning unless DB_HOST is localhost or 127.0.0.1." }
if ($dbUser -notmatch '^[A-Za-z_][A-Za-z0-9_]{0,62}$' -or $dbUser -eq "postgres") { throw "DB_USERNAME must be a non-superuser local role name, not postgres." }
if ($dbName -notmatch '^[A-Za-z_][A-Za-z0-9_]{0,62}$') { throw "DB_NAME must be a simple local database name." }
if ([string]::IsNullOrWhiteSpace($dbPassword)) { throw "DB_PASSWORD must not be empty." }

$composeArgs = @("compose", "--project-name", $ComposeProject, "--file", $composePath, "ps", "--quiet", "postgres")
$containerId = & docker @composeArgs
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($containerId -join ""))) {
  throw "PostgreSQL service is not running in the selected Compose project. Start that project first."
}

$role = Quote-SqlIdentifier $dbUser
$rolePassword = Quote-SqlLiteral $dbPassword
$database = Quote-SqlIdentifier $dbName
$sql = @"
DO `$provision`$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = $(Quote-SqlLiteral $dbUser)) THEN
    EXECUTE 'ALTER ROLE ' || $(Quote-SqlLiteral $role) || ' LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD ' || $(Quote-SqlLiteral $rolePassword) || ';';
  ELSE
    EXECUTE 'CREATE ROLE ' || $(Quote-SqlLiteral $role) || ' LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD ' || $(Quote-SqlLiteral $rolePassword) || ';';
  END IF;
END
`$provision`$;
GRANT CONNECT, TEMPORARY ON DATABASE $database TO $role;
GRANT USAGE, CREATE ON SCHEMA public TO $role;
DO `$transfer_app_objects`$
DECLARE
  object_record record;
  target_role name := $(Quote-SqlLiteral $dbUser);
  target_oid oid;
BEGIN
  SELECT oid INTO target_oid FROM pg_catalog.pg_roles WHERE rolname = target_role;

  FOR object_record IN
    SELECT c.relkind, n.nspname, c.relname
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'S')
      AND c.relowner <> target_oid
  LOOP
    IF object_record.relkind = 'S' THEN
      EXECUTE format('ALTER SEQUENCE %I.%I OWNER TO %I', object_record.nspname, object_record.relname, target_role);
    ELSE
      EXECUTE format('ALTER TABLE %I.%I OWNER TO %I', object_record.nspname, object_record.relname, target_role);
    END IF;
  END LOOP;

  FOR object_record IN
    SELECT n.nspname, t.typname
    FROM pg_catalog.pg_type AS t
    JOIN pg_catalog.pg_namespace AS n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typtype = 'e'
      AND t.typowner <> target_oid
  LOOP
    EXECUTE format('ALTER TYPE %I.%I OWNER TO %I', object_record.nspname, object_record.typname, target_role);
  END LOOP;
END
`$transfer_app_objects`$;
"@

$startInfo = [System.Diagnostics.ProcessStartInfo]::new()
$startInfo.FileName = "docker"
foreach ($argument in @("compose", "--project-name", $ComposeProject, "--file", $composePath, "exec", "--no-TTY", "postgres", "psql", "--username=postgres", "--dbname=$dbName", "--set=ON_ERROR_STOP=1")) {
  [void]$startInfo.ArgumentList.Add($argument)
}
$startInfo.RedirectStandardInput = $true
$startInfo.RedirectStandardOutput = $true
$startInfo.RedirectStandardError = $true
$startInfo.UseShellExecute = $false
$process = [System.Diagnostics.Process]::Start($startInfo)
$process.StandardInput.Write($sql)
$process.StandardInput.Close()
$stdout = $process.StandardOutput.ReadToEnd()
$stderr = $process.StandardError.ReadToEnd()
$process.WaitForExit()
if ($process.ExitCode -ne 0) {
  throw "Local PostgreSQL role provisioning failed. Check the selected Compose project and database configuration; credential details were suppressed."
}

Write-Output "Provisioned the least-privileged backend role for the selected local development database."
