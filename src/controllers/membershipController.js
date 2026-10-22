
const mongoose = require("mongoose");

const Membership = require("../models/Membership");
const MembershipPayment = require("../models/MembershipPayment");

const MEMBERSHIP_PRICES = {
  monthly: 50,
  yearly: 500,
};

const getMembershipStatus = async (req, res) => {
  try {
    const now = new Date();

    // Expire active memberships whose expiry date has passed.
    await Membership.updateMany(
      {
        userId: req.user.userId,
        status: "active",
        expiryDate: { $lte: now },
      },
      {
        $set: { status: "expired" },
      }
    );

    const memberships = await Membership.find({
      userId: req.user.userId,
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return res.json({
      success: true,
      memberships,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const requestMembership = async (req, res) => {
  try {
    const { plan, transactionReference = "" } = req.body;

    if (!["monthly", "yearly"].includes(plan)) {
      return res.status(400).json({
        success: false,
        message: "Choose either the monthly or yearly membership plan",
      });
    }

    const price = MEMBERSHIP_PRICES[plan];

    // Do not create another request while one is awaiting verification.
    const pendingMembership = await Membership.findOne({
      userId: req.user.userId,
      status: "pending",
    });

    if (pendingMembership) {
      return res.status(409).json({
        success: false,
        message: "You already have a pending membership request",
        membershipId: pendingMembership._id,
      });
    }

    // A customer can have only one active membership at a time.
    const activeMembership = await Membership.findOne({
      userId: req.user.userId,
      status: "active",
      expiryDate: { $gt: new Date() },
    });

    if (activeMembership) {
      return res.status(409).json({
        success: false,
        message: "You already have an active membership",
        membershipId: activeMembership._id,
        expiryDate: activeMembership.expiryDate,
      });
    }

    const membership = await Membership.create({
      userId: req.user.userId,
      plan,
      price,
      status: "pending",
    });

    const payment = await MembershipPayment.create({
      membershipId: membership._id,
      userId: req.user.userId,
      amount: price,
      method: "upi",
      transactionReference: String(transactionReference).trim(),
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      message:
        "Membership request submitted. Your membership will start after the librarian verifies your payment.",
      membership: {
        id: membership._id,
        plan: membership.plan,
        price: membership.price,
        status: membership.status,
      },
      payment: {
        id: payment._id,
        amount: payment.amount,
        status: payment.status,
        transactionReference: payment.transactionReference,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


const verifyMembershipPayment = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const { membershipId } = req.body;

      if (!mongoose.Types.ObjectId.isValid(membershipId)) {
        throw new Error("A valid membership ID is required");
      }

      const membership = await Membership.findById(membershipId)
        .session(session);

      if (!membership) {
        throw new Error("Membership request not found");
      }

      if (membership.status !== "pending") {
        throw new Error(
          `Membership is not pending. Current status: ${membership.status}`
        );
      }

      const payment = await MembershipPayment.findOne({
        membershipId: membership._id,
        userId: membership.userId,
      }).session(session);

      if (!payment) {
        throw new Error("Membership payment record not found");
      }

      if (payment.status !== "pending") {
        throw new Error(
          `Payment cannot be verified. Current status: ${payment.status}`
        );
      }

      // Confirm the actual UPI credit before calling this endpoint.
      const now = new Date();
      const startDate = now;
      const expiryDate = new Date(now);

      if (membership.plan === "monthly") {
        expiryDate.setMonth(expiryDate.getMonth() + 1);
      } else if (membership.plan === "yearly") {
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      } else {
        throw new Error("Invalid membership plan");
      }

      membership.startDate = startDate;
      membership.expiryDate = expiryDate;
      membership.status = "active";
      membership.verifiedBy = req.user.userId;
      membership.verifiedAt = now;

      payment.status = "verified";
      payment.verifiedBy = req.user.userId;
      payment.verifiedAt = now;

      await membership.save({ session });
      await payment.save({ session });

      result = {
        membership,
        payment,
      };
    });

    return res.json({
      success: true,
      message: "Membership payment verified and membership activated",
      membership: {
        id: result.membership._id,
        plan: result.membership.plan,
        price: result.membership.price,
        status: result.membership.status,
        startDate: result.membership.startDate,
        expiryDate: result.membership.expiryDate,
      },
      payment: {
        id: result.payment._id,
        amount: result.payment.amount,
        status: result.payment.status,
        verifiedAt: result.payment.verifiedAt,
      },
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  } finally {
    await session.endSession();
  }
};



const getPendingMembershipPayments = async (req, res) => {
  try {
    const payments = await MembershipPayment.find({
      status: "pending",
    })
      .populate({
        path: "userId",
        select: "name email phone",
      })
      .populate({
        path: "membershipId",
        select: "plan price status createdAt",
      })
      .sort({ createdAt: 1 })
      .lean();

    const pendingPayments = payments.filter(
      (payment) =>
        payment.membershipId &&
        payment.membershipId.status === "pending"
    );

    return res.json({
      success: true,
      count: pendingPayments.length,
      payments: pendingPayments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


module.exports = {
  getMembershipStatus,
  requestMembership,
  verifyMembershipPayment,
  getPendingMembershipPayments,
};
