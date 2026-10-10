package update

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// extractBinary pulls the markview executable out of a release archive and
// writes it to destPath with the executable bit set. The goos argument
// selects the archive format (.zip on darwin, .tar.gz elsewhere) and is
// passed explicitly so tests can exercise both paths on any platform.
func extractBinary(archivePath, goos, destPath string) error {
	if goos == "darwin" {
		return extractFromZip(archivePath, destPath)
	}
	return extractFromTarGz(archivePath, destPath)
}

func extractFromTarGz(archivePath, destPath string) error {
	f, err := os.Open(archivePath) //nolint:gosec // path is a checksum-verified temp file we just wrote
	if err != nil {
		return err
	}
	defer f.Close() //nolint:errcheck // read-only handle

	gz, err := gzip.NewReader(f)
	if err != nil {
		return fmt.Errorf("not a gzip archive: %w", err)
	}
	defer gz.Close() //nolint:errcheck // read-only handle

	tr := tar.NewReader(gz)
	for {
		header, err := tr.Next()
		if err == io.EOF {
			return fmt.Errorf("archive does not contain %q", binaryName)
		}
		if err != nil {
			return fmt.Errorf("cannot read archive: %w", err)
		}
		if filepath.Base(header.Name) != binaryName || header.Typeflag != tar.TypeReg {
			continue
		}
		return writeExecutable(tr, destPath, header.FileInfo().Mode())
	}
}

func extractFromZip(archivePath, destPath string) error {
	zr, err := zip.OpenReader(archivePath)
	if err != nil {
		return fmt.Errorf("not a zip archive: %w", err)
	}
	defer zr.Close() //nolint:errcheck // read-only handle

	for _, entry := range zr.File {
		if filepath.Base(entry.Name) != binaryName || entry.FileInfo().IsDir() {
			continue
		}
		src, err := entry.Open()
		if err != nil {
			return fmt.Errorf("cannot open %q in archive: %w", entry.Name, err)
		}
		defer src.Close() //nolint:errcheck // read-only handle
		return writeExecutable(src, destPath, entry.FileInfo().Mode())
	}
	return fmt.Errorf("archive does not contain %q", binaryName)
}

func writeExecutable(src io.Reader, destPath string, mode os.FileMode) error {
	perm := mode.Perm()
	if perm&0o100 == 0 {
		perm |= 0o100
	}
	out, err := os.OpenFile(destPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, perm) //nolint:gosec // dest is a staged temp path we constructed
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, src); err != nil {
		out.Close() //nolint:errcheck // best-effort cleanup after a failed copy
		return fmt.Errorf("cannot write binary: %w", err)
	}
	return out.Close()
}
