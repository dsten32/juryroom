import React, { PureComponent, createRef } from 'react';
import {
  Button, Comment, Container, Rail, Ref, Segment, Sticky, Header,
} from 'semantic-ui-react';
import { Meteor } from 'meteor/meteor';
import Comments from '/imports/api/Comments';
import Discussions from '/imports/api/Discussions';
import Groups from '/imports/api/Groups';
import Scenarios from '/imports/api/Scenarios';
import { withTracker } from 'meteor/react-meteor-data';
import PropTypes from 'prop-types';
import CommentView from './CommentView';
import CommentForm from './CommentForm';
import StarredCommentView from './StarredCommentView';
import DiscussionOverview from './DiscussionOverview';
import {
  UserPropType, ScenarioPropType,
} from '/imports/types';
import NotFoundPage from '/imports/ui/Error/NotFoundPage';
import LoadingPage from '/imports/ui/Error/LoadingPage';

const scrollToElement = require('scroll-to-element');

class DiscussionThread extends PureComponent {
  static defaultProps = {
    participants: false,
    scenario: false,
  }

  static propTypes = {
    discussionId: PropTypes.string.isRequired,
    participants: PropTypes.oneOfType([PropTypes.arrayOf(UserPropType), PropTypes.bool]),
    scenario: PropTypes.oneOfType([ScenarioPropType, PropTypes.bool]),
  }

  contextRef = createRef();

  renderUserReplyingStatus = withTracker(({ discussionId }) => ({
    discussion: Discussions.findOne(
      { _id: discussionId },
      {
        fields: { activeReplies: 1 },
      },
    ),
  }))(({ discussion, participants }) => {
    const userList = discussion
      ? discussion.activeReplies
        .filter(reply => reply.userId !== Meteor.userId())
        .map(reply => participants.find(user => user._id === reply.userId).username)
      : [];

    return userList.length > 0 && (
      <Container>
        <strong>
          {`${userList.join(', ')} is commenting`}
        </strong>
      </Container>
    );
  });

  renderCommentForm = withTracker(({ discussionId }) => ({
    discussion: Discussions.findOne(
      { _id: discussionId },
      {
        fields: {
          activeReplies: 1,
          commentLengthLimit: 1,
        },
      },
    ),
  }))(({ discussion }) => (
    (discussion && discussion.activeReplies.some(reply => reply.userId === Meteor.userId()))
      ? (
        <CommentForm
          discussion={discussion}
          parentId=""
        />
      )
      : (
        <Button
          onClick={() => Meteor.call('comments.reply', discussion._id, '')}
          content="Post"
          labelPosition="left"
          icon="edit"
          primary
        />
      )
  ));

  discussionComments = withTracker(({ discussionId }) => ({
    discussion: Discussions.findOne(
      { _id: discussionId },
      {
        fields: {
          activeVote: 1,
          commentLengthLimit: 1,
          status: 1,
        },
      },
    ),
    rootComments: Comments.find(
      {
        discussionId,
        parentId: '',
      },
      {
        fields: { _id: 1 },
        sort: { postedTime: 1 },
      },
    ).fetch(),
  }))(({ discussion, participants, rootComments }) => discussion && rootComments.map(({ _id }) => (
    <CommentView
      key={_id}
      discussion={discussion}
      participants={participants}
      commentId={_id}
    />
  )));

  scrollToComment = (commentId) => {
    scrollToElement(`#${CSS.escape(commentId)}`, { align: 'top', offset: -120 });
  }

  render() {
    const {
      participants, scenario, discussionId,
    } = this.props;

    if (!scenario) {
      return <NotFoundPage />;
    }

    return (
      <Ref innerRef={this.contextRef}>
        <Segment>
          {scenario && (
            <Header
              size="large"
              attached="top"
              content={scenario.title}
              subheader={scenario.description}
            />
          )}
          <Comment.Group threaded attached="bottom">
            <this.discussionComments
              participants={participants}
              discussionId={discussionId}
            />
            <this.renderUserReplyingStatus
              participants={participants}
              discussionId={discussionId}
            />
          </Comment.Group>
          <this.renderCommentForm discussionId={discussionId} />
          <Rail position="left">
            <Sticky context={this.contextRef} offset={80}>
              <StarredCommentView
                discussionId={discussionId}
                participants={participants}
                scrollToComment={this.scrollToComment}
              />
            </Sticky>
          </Rail>
          <Rail position="right">
            <Sticky context={this.contextRef} offset={80}>
              <DiscussionOverview
                discussionId={discussionId}
                scrollToComment={this.scrollToComment}
              />
            </Sticky>
          </Rail>
        </Segment>
      </Ref>
    );
  }
}

export default withTracker(({ match }) => {
  const { discussionId } = match.params;
  Meteor.subscribe('comments', discussionId);
  Meteor.subscribe('votes', discussionId);

  const discussion = Discussions.findOne(
    { _id: discussionId },
    {
      fields: { scenarioId: 1 },
    },
  );

  return {
    discussionId,
    scenario:
      discussion
      && Scenarios.findOne({ _id: discussion.scenarioId }),
    participants:
      discussion
      && Meteor.users.find({
        _id: {
          $in: Groups.findOne(
            { discussions: { $elemMatch: { discussionId } } },
          ).members,
        },
      }).fetch(),
  };
})(DiscussionThread);
