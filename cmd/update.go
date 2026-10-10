package cmd

import (
	"fmt"
	"os"

	"github.com/pubgo/markview/internal/update"
	"github.com/pubgo/markview/version"
	"github.com/spf13/cobra"
)

var (
	updateCheckOnly bool
	updateSource    string
)

var updateCmd = &cobra.Command{
	Use:   "update",
	Short: "Check for a newer markview release and replace the running binary",
	Long: `Check GitHub for a newer markview release and, if one exists, download
it, verify its checksum, and atomically replace the currently running
binary. Running markview servers keep serving the old version until they
are restarted (markview --restart).

The release source defaults to the GitHub API and can be overridden with
--source or the MARKVIEW_UPDATE_SOURCE environment variable (useful for
mirrors or self-hosted manifests). Relative asset URLs in a custom
manifest resolve against the source base URL.`,
	Args: cobra.NoArgs,
	RunE: runUpdate,
}

func init() {
	updateCmd.Flags().BoolVar(&updateCheckOnly, "check", false, "Only check for a newer version; do not download or replace anything")
	updateCmd.Flags().StringVar(&updateSource, "source", "", "Update source API base URL (default: MARKVIEW_UPDATE_SOURCE or https://api.github.com)")
	rootCmd.AddCommand(updateCmd)
}

func runUpdate(cmd *cobra.Command, _ []string) error {
	client := update.NewClient(updateSource)

	rel, err := client.Latest(cmd.Context())
	if err != nil {
		return fmt.Errorf("check for updates failed: %w", err)
	}
	if !update.IsNewer(rel.TagName) {
		fmt.Fprintf(os.Stderr, "markview: already up to date (version %s)\n", version.Version)
		return nil
	}

	fmt.Fprintf(os.Stderr, "markview: %s available (current version %s)\n", rel.TagName, version.Version)
	if updateCheckOnly {
		return nil
	}

	if err := client.Apply(cmd.Context(), rel); err != nil {
		return fmt.Errorf("update to %s failed: %w", rel.TagName, err)
	}
	fmt.Fprintf(os.Stderr, "markview: updated to %s — restart running servers with `markview --restart`\n", rel.TagName)
	return nil
}
