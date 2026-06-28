using System.ComponentModel.DataAnnotations;

namespace BitMono.Web.Data.Entities;

// A per-user signal on a writeup: a plain upvote, or "this helped me solve it" (solver-gated).
// Counts are denormalized onto Solution (UpvoteCount / HelpedCount) for cheap sorting.
public class SolutionVote
{
    [Key] public Guid Id { get; set; }

    public Guid SolutionId { get; set; }
    public Solution Solution { get; set; } = null!;

    public Guid VoterUserId { get; set; }
    public SolutionVoteKind Kind { get; set; }
    public DateTime CreatedAt { get; set; }
}
